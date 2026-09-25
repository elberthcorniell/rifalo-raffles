"use client";

import { useState, useEffect, useMemo } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import PhoneInput from "@/components/ui/phone-input";
import { Label } from "@/components/ui/label";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Upload,
  Minus,
  Plus,
  Building2,
  Loader2,
  Check,
  Copy,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useRouter } from "next/navigation";
import { useOrg } from "@/components/OrgBrandProvider";
import {
  normalizeCheckoutFields,
  type CheckoutFields,
} from "@/types/org";

interface BankAccount {
  id: string;
  name: string;
  bank: string;
  accountNumber: string;
  accountType: string;
  currency: string;
  holderName?: string;
  cedula?: string;
}

interface PurchaseDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  raffleId: string;
  ticketPrice: number;
  availableTickets: number;
  minTickets?: number;
}

const purchaseBaseSchema = z.object({
  name: z.string().optional().default(""),
  email: z.string().optional().default(""),
  whatsappNumber: z.string().optional().default(""),
  ticketQuantity: z.number().min(1, "Debes seleccionar al menos 1 boleto"),
  accountId: z
    .string({ required_error: "Selecciona una cuenta bancaria" })
    .uuid("Selecciona una cuenta bancaria"),
  voucher: z
    .instanceof(File, { message: "Sube el comprobante de transferencia" })
    .refine(
      (file) => file.size <= 5 * 1024 * 1024,
      "El archivo no debe exceder 5MB",
    )
    .refine(
      (file) =>
        ["image/jpeg", "image/png", "image/jpg", "application/pdf"].includes(
          file.type,
        ),
      "Formato inválido. Solo JPG, PNG o PDF",
    ),
});

function purchaseFormSchema(fields: CheckoutFields) {
  return purchaseBaseSchema.superRefine((data, ctx) => {
    if (fields.name && (!data.name || data.name.trim().length < 2)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["name"],
        message: "El nombre debe tener al menos 2 caracteres",
      });
    }
    if (fields.email) {
      const email = data.email?.trim() || "";
      if (!email || !z.string().email().safeParse(email).success) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["email"],
          message: "Correo electrónico inválido",
        });
      }
    }
    if (fields.phone) {
      const phone = data.whatsappNumber?.trim() || "";
      if (phone.length < 10 || !/^[\d\s\-\+\(\)]+$/.test(phone)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["whatsappNumber"],
          message: "Número de WhatsApp inválido",
        });
      }
    }
  });
}

type PurchaseFormData = z.infer<typeof purchaseBaseSchema>;

export default function PurchaseDialog({
  open,
  onOpenChange,
  raffleId,
  ticketPrice,
  availableTickets,
  minTickets = 1,
}: PurchaseDialogProps) {
  const effectiveMin = Math.max(
    1,
    Math.min(minTickets, availableTickets || minTickets),
  );
  const [accounts, setAccounts] = useState<BankAccount[]>([]);
  const [isLoadingAccounts, setIsLoadingAccounts] = useState(false);
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const { toast } = useToast();
  const router = useRouter();
  const { org } = useOrg();
  const checkoutFields = useMemo(
    () => normalizeCheckoutFields(org?.checkout_fields),
    [org?.checkout_fields],
  );
  const schema = useMemo(
    () => purchaseFormSchema(checkoutFields),
    [checkoutFields],
  );

  const copyToClipboard = async (
    text: string,
    fieldId: string,
    e: React.MouseEvent,
  ) => {
    e.stopPropagation();
    try {
      await navigator.clipboard.writeText(text);
      setCopiedField(fieldId);
      setTimeout(() => setCopiedField(null), 2000);
    } catch {
      toast({
        title: "Error",
        description: "No se pudo copiar al portapapeles",
        variant: "destructive",
      });
    }
  };

  const form = useForm<PurchaseFormData>({
    resolver: (values, context, options) =>
      zodResolver(schema)(values, context, options),
    defaultValues: {
      name: "",
      email: "",
      whatsappNumber: "",
      ticketQuantity: effectiveMin,
      accountId: undefined,
      voucher: undefined,
    },
  });

  const { watch, setValue, reset } = form;
  const ticketQuantity = watch("ticketQuantity");
  const selectedAccountId = watch("accountId");
  const voucherFile = watch("voucher");
  const totalPrice = ticketQuantity * ticketPrice;

  useEffect(() => {
    if (open) {
      setValue("ticketQuantity", effectiveMin);
      fetchAccounts();
    }
  }, [open, effectiveMin]);

  const fetchAccounts = async () => {
    setIsLoadingAccounts(true);
    try {
      const response = await fetch("/api/accounts");
      const result = await response.json();
      if (result.success && result.data.length > 0) {
        setAccounts(result.data);
        setValue("accountId", result.data[0].id);
      }
    } catch (error) {
      console.error("Error fetching accounts:", error);
      toast({
        title: "Error",
        description: "No se pudieron cargar las cuentas bancarias",
        variant: "destructive",
      });
    } finally {
      setIsLoadingAccounts(false);
    }
  };

  const handleQuantityChange = (delta: number) => {
    const newQuantity = ticketQuantity + delta;
    if (newQuantity >= effectiveMin && newQuantity <= availableTickets) {
      setValue("ticketQuantity", newQuantity);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setValue("voucher", file, { shouldValidate: true });
    }
  };

  const onSubmit = async (data: PurchaseFormData) => {
    if (data.ticketQuantity < effectiveMin) {
      toast({
        title: "Cantidad inválida",
        description: `El mínimo de boletos es ${effectiveMin}`,
        variant: "destructive",
      });
      return;
    }

    try {
      const formData = new FormData();
      formData.append("voucher", data.voucher);
      formData.append("raffleId", raffleId.toString());
      formData.append("ticketQuantity", data.ticketQuantity.toString());
      formData.append("totalAmount", totalPrice.toString());
      if (checkoutFields.name && data.name?.trim()) {
        formData.append("name", data.name.trim());
      }
      if (checkoutFields.phone && data.whatsappNumber?.trim()) {
        formData.append("whatsappNumber", data.whatsappNumber.trim());
      }
      formData.append("accountId", data.accountId.toString());
      if (checkoutFields.email && data.email?.trim()) {
        formData.append("email", data.email.trim());
      }

      const response = await fetch("/api/purchases/voucher", {
        method: "POST",
        body: formData,
      });

      const result = await response.json();

      if (result.success) {
        const whatsapp = data.whatsappNumber?.trim();
        toast({
          title: "¡Comprobante enviado!",
          description:
            "Tu comprobante ha sido recibido. Te notificaremos cuando sea verificado.",
        });
        reset({
          name: "",
          email: "",
          whatsappNumber: "",
          ticketQuantity: effectiveMin,
          accountId: undefined,
          voucher: undefined,
        });
        onOpenChange(false);
        if (checkoutFields.phone && whatsapp) {
          router.push(`/verify-tickets?phone=${encodeURIComponent(whatsapp)}`);
        }
      } else {
        toast({
          title: "Error",
          description:
            result.code === "TICKET_QUOTA_EXCEEDED"
              ? "Esta rifa no está aceptando compras en este momento. Intenta más tarde."
              : result.error || "Error al enviar el comprobante",
          variant: "destructive",
        });
      }
    } catch (error) {
      toast({
        title: "Error",
        description:
          "Error al enviar el comprobante. Por favor intenta de nuevo.",
        variant: "destructive",
      });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-2xl font-bold text-foreground">
            Comprar Boletos
          </DialogTitle>
          <DialogDescription>
            Selecciona la cantidad de boletos y envía el comprobante de
            transferencia
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">

            {(checkoutFields.name ||
              checkoutFields.email ||
              checkoutFields.phone) && (
              <div className="space-y-4 border-card-border">
                {checkoutFields.name && (
                  <FormField
                    control={form.control}
                    name="name"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Nombre completo *</FormLabel>
                        <FormControl>
                          <Input placeholder="Ej: Juan Pérez" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                )}

                {checkoutFields.email && (
                  <FormField
                    control={form.control}
                    name="email"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Correo electrónico *</FormLabel>
                        <FormControl>
                          <Input
                            type="email"
                            placeholder="Ej: juan@ejemplo.com"
                            {...field}
                          />
                        </FormControl>
                        <FormDescription>
                          Te enviaremos confirmación cuando tu pago sea
                          verificado
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                )}

                {checkoutFields.phone && (
                  <FormField
                    control={form.control}
                    name="whatsappNumber"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Número de WhatsApp *</FormLabel>
                        <FormControl>
                          <PhoneInput
                            defaultCountry="do"
                            value={field.value || ""}
                            onChange={field.onChange}
                            placeholder="809 123 4567"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                )}
              </div>
            )}


                        {/* Ticket Quantity Selector */}
            <div className="space-y-4 py-4">
              <div className="flex items-center justify-between p-4 bg-muted rounded-lg">
                <div>
                  <Label className="text-base font-medium">
                    Cantidad de boletos
                  </Label>
                  {effectiveMin > 1 && (
                    <p className="text-xs text-muted-foreground mt-1">
                      Mínimo {effectiveMin} boletos
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-3">
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    onClick={() => handleQuantityChange(-1)}
                    disabled={ticketQuantity <= effectiveMin}
                    className="h-9 w-9"
                  >
                    <Minus className="h-4 w-4" />
                  </Button>
                  <span className="text-xl font-bold min-w-[3rem] text-center">
                    {ticketQuantity}
                  </span>
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    onClick={() => handleQuantityChange(1)}
                    disabled={ticketQuantity >= availableTickets}
                    className="h-9 w-9"
                  >
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              {/* Price Summary */}
              <div className="space-y-2 p-4 bg-gradient-card border border-card-border rounded-lg">
                <div className="flex justify-between text-sm text-muted-foreground">
                  <span>
                    {ticketQuantity} boletos × RD${ticketPrice.toLocaleString()}
                  </span>
                  <span>
                    RD${(ticketQuantity * ticketPrice).toLocaleString()}
                  </span>
                </div>
                <div className="flex justify-between items-center pt-2 border-t border-card-border">
                  <span className="text-lg font-bold">Total</span>
                  <span className="text-2xl font-bold text-foreground">
                    RD${totalPrice.toLocaleString()}
                  </span>
                </div>
              </div>
            </div>


            <div className="space-y-4">
              <FormField
                control={form.control}
                name="accountId"
                render={({ field }) => {
                  const selectedAccount = accounts.find(
                    (account) => account.id === field.value,
                  );
                  return (
                    <FormItem>
                      <FormLabel>
                        Selecciona la cuenta para transferir *
                      </FormLabel>
                      {isLoadingAccounts ? (
                        <div className="flex items-center justify-center p-4 bg-muted rounded-lg">
                          <Loader2 className="h-5 w-5 animate-spin mr-2" />
                          <span className="text-sm text-muted-foreground">
                            Cargando cuentas...
                          </span>
                        </div>
                      ) : accounts.length > 0 ? (
                        <div className="space-y-3">
                          <Select
                            value={field.value}
                            onValueChange={(value) => field.onChange(value)}
                          >
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Selecciona un banco" />
                              </SelectTrigger>
                            </FormControl>
                              <SelectContent className="bg-card text-card-foreground">
                              {accounts.map((account) => (
                                <SelectItem key={account.id} value={account.id}>
                                  {account.bank || account.name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>

                          {selectedAccount && (
                            <div className="rounded-lg border bg-muted p-4 space-y-2">
                              <div className="flex items-center gap-2">
                                <Building2 className="h-4 w-4 text-secondary" />
                                <span className="font-semibold">
                                  {selectedAccount.bank || selectedAccount.name}
                                </span>
                              </div>
                              {selectedAccount.accountNumber && (
                                <p className="text-sm text-muted-foreground flex items-center gap-1 flex-wrap">
                                  <span>{selectedAccount.accountType}:</span>
                                  <span className="font-mono">
                                    {selectedAccount.accountNumber}
                                  </span>
                                  <button
                                    type="button"
                                    onClick={(e) =>
                                      copyToClipboard(
                                        selectedAccount.accountNumber,
                                        `account-${selectedAccount.id}`,
                                        e,
                                      )
                                    }
                                    className="inline-flex items-center gap-1 text-xs text-secondary hover:text-secondary/80 transition-colors ml-1"
                                    title="Copiar número de cuenta"
                                  >
                                    {copiedField ===
                                    `account-${selectedAccount.id}` ? (
                                      <Check className="h-3 w-3" />
                                    ) : (
                                      <Copy className="h-3 w-3" />
                                    )}
                                  </button>
                                </p>
                              )}
                              {selectedAccount.holderName && (
                                <p className="text-sm text-muted-foreground">
                                  A nombre de: {selectedAccount.holderName}
                                </p>
                              )}
                            </div>
                          )}
                        </div>
                      ) : (
                        <div className="p-4 bg-muted rounded-lg text-center text-muted-foreground">
                          <p>No hay cuentas bancarias disponibles</p>
                        </div>
                      )}
                      <FormMessage />
                    </FormItem>
                  );
                }}
              />

              <FormField
                control={form.control}
                name="voucher"
                render={() => (
                  <FormItem>
                    <FormLabel>Subir comprobante de transferencia *</FormLabel>
                    <FormControl>
                      <div className="flex items-center gap-4">
                        <Input
                          type="file"
                          accept="image/*,.pdf"
                          onChange={handleFileChange}
                          className="flex-1"
                        />
                        {voucherFile && (
                          <span className="text-sm text-muted-foreground">
                            {voucherFile.name}
                          </span>
                        )}
                      </div>
                    </FormControl>
                    <FormDescription>
                      Formatos aceptados: JPG, PNG, PDF (máx. 5MB)
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <Button
                type="submit"
                className="w-full bg-secondary text-secondary-foreground hover:bg-secondary/90 shadow-secondary font-bold py-6"
                size="lg"
                disabled={form.formState.isSubmitting}
              >
                {form.formState.isSubmitting ? (
                  <>
                    <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                    Enviando...
                  </>
                ) : (
                  <>
                    <Upload className="w-5 h-5 mr-2" />
                    Enviar Comprobante
                  </>
                )}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
