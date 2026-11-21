# Correo de bienvenida con Resend

Rifalo manda un correo al dueño de la rifa justo después de que crea su cuenta y publica la rifa en `/signup`. El envío sale de `POST /api/emails/welcome`. Si `RESEND_API_KEY` no está, el servidor escribe una advertencia y no hace nada: el registro no falla.

Los correos de compras siguen en SendGrid. Este documento es solo el correo de bienvenida.

No envíes este correo a clientes reales mientras lo pruebas. Usa un buzón tuyo.

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

3. Marca la clave como Sensitive.
4. Redeploy del deployment de **Preview** para que tome las variables. No hace falta un deploy de producción.
5. Cuando el correo de prueba esté bien, repite las mismas variables en **Production** y redeploy de producción.

Si `RESEND_API_KEY` falta en un entorno, el signup sigue igual y en los logs aparece `RESEND_API_KEY is not configured. Skipping welcome email.`

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
