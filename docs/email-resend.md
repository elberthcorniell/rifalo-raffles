# Correos con Resend

Rifalo manda tres correos con Resend, todos al dueño de la rifa:

- Bienvenida, justo después de crear la cuenta y publicar la rifa en `/signup` (`POST /api/emails/welcome`).
- Respuesta de verificación, cuando un superadmin aprueba o rechaza la solicitud.
- Recordatorio, mientras haya compras pendientes de revisar.

Si `RESEND_API_KEY` no está, el servidor escribe una advertencia y no envía nada. El registro, la respuesta de verificación y el cron siguen igual.

Los correos de compras al comprador siguen en SendGrid. Este documento es solo Resend.

No envíes estos correos a clientes reales mientras los pruebas. Usa un buzón tuyo.

## 1. Cuenta y dominio en Resend

1. Entra a [resend.com/signup](https://resend.com/signup) y crea una cuenta, o usa la que ya tenga el equipo.
2. En **API Keys**, crea una clave con permiso de envío. Cópiala una sola vez. No la pongas en git ni en un mensaje.
3. En **Domains**, agrega el dominio desde el que vas a enviar.

El código usa por defecto `Rifalo <hola@rifalo.do>`. Esa dirección solo funciona si verificas el dominio raíz `rifalo.do`.

Recomendación: verifica el subdominio `mail.rifalo.do` en vez del raíz. Resend lo sugiere para separar la reputación del dominio, y hoy `rifalo.do` no tiene MX ni TXT, así que no choca con un buzón existente. Si haces eso, el remitente tiene que vivir en ese subdominio. En Vercel define:

```env
EMAIL_FROM=Rifalo <hola@mail.rifalo.do>
```

Si prefieres que el correo salga de `hola@rifalo.do` (el default del código y el correo de la marca), agrega `rifalo.do` en Resend y deja `EMAIL_FROM` sin definir.

Elige la región más cercana a quien recibe. Para República Dominicana suele ser **North Virginia (us-east-1)**. El valor del MX cambia con la región: copia el que muestre Resend, no lo inventes.

## 2. Registros DNS en Vercel

El DNS de `rifalo.do` ya está en Vercel (`ns1.vercel-dns.com` y `ns2.vercel-dns.com`). Los registros se agregan ahí, no en el registrador.

1. Vercel → **Domains** → `rifalo.do`.
2. Confirma que los nameservers son `ns1.vercel-dns.com` y `ns2.vercel-dns.com`.
3. Abre **DNS Records**.
4. En Resend, abre el dominio → pestaña **Records**.
5. Crea en Vercel cada fila que muestre Resend, con el mismo tipo, nombre y valor. No recortes el DKIM.

Resend genera la clave DKIM. No uses un valor de ejemplo. Pega el texto completo.

Los dominios nuevos pueden mostrar dos **CNAME** en lugar del par MX + TXT. Si ves CNAME, agrega esos CNAME y no el esquema viejo. Un CNAME no puede convivir con otro registro en el mismo nombre.

### Si verificas `rifalo.do` (correo `hola@rifalo.do`)

En Vercel el nombre es relativo a `rifalo.do`. No escribas el dominio otra vez.

| Tipo | Nombre en Vercel | Valor | Prioridad |
| --- | --- | --- | --- |
| TXT | `resend._domainkey` | el DKIM que muestra Resend (`p=...`, completo) | — |
| MX | `send` | el host de Resend, casi siempre `feedback-smtp.<región>.amazonses.com` | 10 |
| TXT | `send` | el SPF que muestra Resend, casi siempre `v=spf1 include:amazonses.com ~all` | — |
| TXT | `_dmarc` | `v=DMARC1; p=none;` (opcional) | — |

El MX y el SPF van en el subdominio `send` (`send.rifalo.do`). No los pongas en la raíz: un MX en `@` desviaría el correo que algún día llegue a `hola@rifalo.do`. En Vercel la prioridad del MX va en el campo **Priority** (`10`). El valor es solo el hostname, sin el `10` delante.

### Si verificas `mail.rifalo.do` (recomendado)

Agrega `mail.rifalo.do` en Resend, no el raíz. Los nombres en Vercel quedan así:

| Tipo | Nombre en Vercel | Valor |
| --- | --- | --- |
| TXT | `resend._domainkey.mail` | DKIM exacto de Resend |
| MX | `send.mail` | host de Resend, prioridad 10 |
| TXT | `send.mail` | SPF exacto de Resend |
| TXT | `_dmarc.mail` | `v=DMARC1; p=none;` (opcional) |

Y en las variables de entorno:

```env
EMAIL_FROM=Rifalo <hola@mail.rifalo.do>
```

### Después de guardar

1. Revisa que Vercel no haya pegado `.rifalo.do` al final del hostname del MX. Si el valor quedó `feedback-smtp.us-east-1.amazonses.com.rifalo.do`, edítalo y termina el hostname con un punto.
2. Espera. Muchas veces verifica en menos de 15 minutos. Puede tardar hasta 72 horas.
3. En Resend pulsa **Verify** o **Restart verification** si sigue pendiente.
4. Puedes revisar la propagación con [dns.email](https://dns.email) de Resend.

DMARC es opcional. `p=none` solo pide informes y no bloquea correo. No pongas `rua=` hasta tener un buzón que lea esos informes.

## 3. Variables en Vercel (proyecto `cura-raffles`)

Primero **Preview**. Producción se llena cuando el correo de prueba se vea bien.

1. Vercel → proyecto **cura-raffles** → **Settings** → **Environment Variables**.
2. Agrega:

| Nombre | Valor | Entorno |
| --- | --- | --- |
| `RESEND_API_KEY` | la clave de Resend (`re_...`) | Preview |
| `EMAIL_FROM` | `Rifalo <hola@mail.rifalo.do>` si verificaste el subdominio. Si verificaste la raíz, puedes omitirla: el default es `Rifalo <hola@rifalo.do>` | Preview |
| `EMAIL_REPLY_TO` | opcional. Solo si ese buzón ya recibe correo | Preview |
| `CRON_SECRET` | un secreto largo, al azar. Vercel Cron lo manda como `Authorization: Bearer ...` al recordatorio. Si falta, esa ruta responde 401 | Preview y Production |

3. Marca la clave como Sensitive.
4. Redeploy del deployment de **Preview** para que tome las variables. No hace falta un deploy de producción.
5. Cuando el correo de prueba esté bien, repite las mismas variables en **Production** y redeploy de producción.

Si `RESEND_API_KEY` falta en un entorno, el signup sigue igual y en los logs aparece `RESEND_API_KEY is not configured. Skipping welcome email.` La verificación y el cron avisan con su propia frase y tampoco envían.

## 4. Cómo probarlo sin escribirle a un cliente

Hasta que el dominio verifique, Resend solo entrega al correo de la cuenta de Resend. Úsalo.

1. En el deployment de Preview, abre `/signup`.
2. Crea una cuenta con un buzón tuyo (el de la cuenta de Resend, o el tuyo cuando el dominio ya esté verificado). No uses el correo de un cliente.
3. Publica la rifa de prueba.
4. El wizard llama `POST /api/emails/welcome` y no espera la respuesta. Si el correo falla, la cuenta y la rifa quedan creadas.
5. Revisa la bandeja y, en Resend, **Emails**.
6. Vuelve a publicar o a pegarle al endpoint con la misma sesión: no debe salir un segundo correo. El usuario queda marcado en `user_metadata.welcome_email_sent_at`.
7. Borra la organización de prueba si no la vas a usar.

No recorras usuarios existentes para “ponerlos al día”. Este correo es solo para quien acaba de registrarse (cuenta creada en las últimas 24 horas y sin la marca de envío).

## 5. Respuesta de verificación

Cuando un superadmin aprueba o rechaza una rifa en revisión, `PATCH /api/platform/superadmin/raffles/[id]` guarda la decisión y después escribe al dueño. Si el correo falla, la decisión queda guardada.

El correo dice si quedó verificada o rechazada. Si hay motivo o nota, va en el mensaje. El botón abre `/admin/raffles` de esa organización.

Se manda una sola vez por solicitud. La marca es `raffles.verification_response_email_for`: guarda el `verification_requested_at` de la solicitud ya avisada. Si el dueño vuelve a pedir verificación, esa fecha cambia y la nueva respuesta puede generar otro correo. Un segundo clic sobre la misma solicitud no manda otro.

La migración marca como ya avisadas las rifas que ya estaban verificadas o rechazadas. No se les escribe por el pasado. Si el envío falla, el mismo cron de recordatorios vuelve a intentarlo durante 48 horas, con la misma clave de idempotencia.

El destinatario es el usuario con rol `owner`. Si no se puede leer su correo, se usa `admin_email` y, si tampoco está, `email` de la organización.

## 6. Recordatorio de compras pendientes

La cola es `purchases` con `status = 'pending'` (comprobantes esperando confirmación). Los boletos de referido se crean ya confirmados, así que no arrancan el reloj. Si una compra vuelve a `pending`, entra en la cola.

El cron es `GET /api/cron/pending-review-reminders`, cada 15 minutos (`vercel.json`). Solo corre si el header es `Authorization: Bearer <CRON_SECRET>`. Sin `CRON_SECRET` responde 401. Sin `RESEND_API_KEY` responde 200 y no envía.

Cada corrida revisa como máximo 50 organizaciones, las que ya cumplieron el siguiente paso. La consulta usa el índice de compras pendientes.

### Horario

El reloj de una organización es `org_review_reminders.queue_started_at`: el `submitted_at` de la compra pendiente más antigua en el momento en que la cola dejó de estar vacía.

Los pasos son 1, 2, 4, 8, 16… horas desde ese inicio (el doble cada vez, hasta 65536). En cada corrida sale como máximo un correo, el del paso más alto que ya se cumplió y todavía no se envió. Si el cron estuvo caído, no se recuperan los pasos intermedios: se manda el último que ya tocaba.

Ejemplo, cola que empieza a las 12:00:

| Hora | Qué pasa |
| --- | --- |
| 13:00 | primer correo (1 hora) |
| 14:00 | segundo (2 horas) |
| 15:00 | nada |
| 16:00 | tercero (4 horas) |
| 20:00 | cuarto (8 horas) |

El cron de cada 15 minutos puede atrasar un paso hasta 15 minutos. No manda un correo en cada corrida.

`last_step_hours` guarda el último paso enviado. Antes de enviar se reserva ese paso; si Resend no acepta el correo, se suelta la reserva para intentarlo en la siguiente corrida. La clave de idempotencia de Resend incluye la organización, el inicio de la cola y el paso, así un reintento no duplica el mismo aviso.

### Cuándo se reinicia

Mientras quede alguna compra `pending`, el inicio de la cola no se mueve. Revisar la más antigua y dejar otras pendientes no reinicia el horario.

Cuando la cola queda en cero, un trigger borra la fila de `org_review_reminders`. La próxima compra pendiente crea una fila nueva, con `last_step_hours` en 0, y el primer recordatorio vuelve a ser a la hora.

La migración es `20261121130914_owner_review_notifications.sql`. No edita migraciones ya aplicadas. Hay que aplicarla en Supabase antes de que estos correos funcionen en ese proyecto.

El botón del recordatorio abre `/admin/purchases`. El texto dice cuántas compras siguen pendientes y desde hace cuántas horas, como mínimo, espera la más antigua.
