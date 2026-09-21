"use client";

import { useState, useEffect, useCallback, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import PhoneInput from "@/components/ui/phone-input";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowLeft, Search, Ticket, Clock, CheckCircle, XCircle, AlertCircle, Phone } from "lucide-react";

interface TicketElement {
  description: string;
  quantity: number;
  price: number;
  resourceId?: string;
}

interface TicketRecord {
  id: string;
  date: string;
  state: string;
  amount: number;
  currency: string;
  paid: number;
  dueToPay: number;
  description?: string;
  elements: TicketElement[];
  ticketNumbers: string[];
  metadata: {
    name?: string;
    status?: string;
    submittedAt?: string;
  };
}

interface VerifyResponse {
  success: boolean;
  data?: {
    contact: {
      id: string;
      name: string;
    } | null;
    tickets: TicketRecord[];
  };
  message?: string;
  error?: string;
}

function getStateInfo(state: string) {
  switch (state?.toUpperCase()) {
    case 'COMPLETED':
    case 'PAID':
      return { label: 'Completado', variant: 'default' as const, icon: CheckCircle, className: 'bg-green-600 hover:bg-green-600' };
    case 'PENDING':
      return { label: 'Pendiente', variant: 'secondary' as const, icon: Clock, className: 'bg-yellow-600 hover:bg-yellow-600 text-black' };
    case 'CANCELLED':
    case 'CANCELED':
      return { label: 'Cancelado', variant: 'destructive' as const, icon: XCircle, className: '' };
    default:
      return { label: state || 'Desconocido', variant: 'secondary' as const, icon: AlertCircle, className: '' };
  }
}

function formatDate(dateString: string) {
  try {
    return new Date(dateString).toLocaleDateString('es-DO', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return dateString;
  }
}

function formatCurrency(amount: number, currency: string = 'DOP') {
  return `RD$${amount.toLocaleString('es-DO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export default function VerifyTicketsPage() {
  return (
    <Suspense>
      <VerifyTicketsContent />
    </Suspense>
  );
}

function VerifyTicketsContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [phone, setPhone] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<VerifyResponse | null>(null);
  const [searched, setSearched] = useState(false);

  const searchTickets = useCallback(async (phoneNumber: string) => {
    if (!phoneNumber || phoneNumber.replace(/\D/g, '').length < 5) return;

    setLoading(true);
    setResult(null);
    setSearched(true);

    try {
      const response = await fetch('/api/tickets/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: phoneNumber.trim() }),
      });

      const data: VerifyResponse = await response.json();
      setResult(data);
    } catch (error) {
      setResult({
        success: false,
        error: 'Error de conexión. Intente de nuevo.',
      });
    } finally {
      setLoading(false);
    }
  }, []);

  // Auto-search when phone query param is present
  useEffect(() => {
    const phoneParam = searchParams.get('phone');
    if (phoneParam) {
      setPhone(phoneParam);
      searchTickets(phoneParam);
    }
  }, [searchParams, searchTickets]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    searchTickets(phone);
  };

  const tickets = result?.data?.tickets || [];
  const contact = result?.data?.contact;
  const hasTickets = tickets.length > 0;

  return (
    <div className="min-h-screen bg-background font-poppins pb-20 md:pb-0">
      <Header />
      <main className="container mx-auto px-4 py-8 max-w-2xl">
        <Button
          variant="ghost"
          onClick={() => router.back()}
          className="mb-6 text-primary hover:text-primary/80"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Volver
        </Button>

        {/* Title Section */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-secondary/10 mb-4">
            <Ticket className="w-8 h-8 text-secondary" />
          </div>
          <h1 className="text-3xl font-bold text-foreground mb-2">
            Verificar Boletos
          </h1>
          <p className="text-muted-foreground">
            Ingresa tu número de teléfono para ver tus boletos comprados
          </p>
        </div>

        {/* Phone Input Form */}
        <Card className="p-6 bg-gradient-card border-card-border mb-8">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground flex items-center gap-2">
                <Phone className="w-4 h-4" />
                Número de Teléfono
              </label>
              <PhoneInput
                value={phone}
                onChange={(value) => setPhone(value)}
                defaultCountry="do"
                inputClassName="!text-base"
              />
            </div>
            <Button
              type="submit"
              className="w-full bg-secondary text-secondary-foreground hover:bg-secondary/90 font-semibold h-12 text-base"
              disabled={loading || !phone || phone.replace(/\D/g, '').length < 5}
            >
              {loading ? (
                <div className="flex items-center gap-2">
                  <div className="w-5 h-5 border-2 border-secondary-foreground/30 border-t-secondary-foreground rounded-full animate-spin" />
                  Buscando...
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <Search className="w-5 h-5" />
                  Buscar Boletos
                </div>
              )}
            </Button>
          </form>
        </Card>

        {/* Loading State */}
        {loading && (
          <div className="space-y-4">
            {[1, 2].map((i) => (
              <Card key={i} className="p-6 bg-gradient-card border-card-border">
                <div className="space-y-3">
                  <div className="flex justify-between">
                    <Skeleton className="h-6 w-32" />
                    <Skeleton className="h-6 w-24" />
                  </div>
                  <Skeleton className="h-4 w-48" />
                  <div className="flex gap-2">
                    <Skeleton className="h-8 w-16" />
                    <Skeleton className="h-8 w-16" />
                    <Skeleton className="h-8 w-16" />
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}

        {/* Results */}
        {!loading && searched && result && (
          <div className="space-y-6">
            {/* Error State */}
            {!result.success && (
              <Card className="p-6 bg-gradient-card border-card-border">
                <div className="text-center py-4">
                  <XCircle className="w-12 h-12 text-destructive mx-auto mb-3" />
                  <p className="text-destructive font-medium">{result.error}</p>
                </div>
              </Card>
            )}

            {/* No Tickets Found */}
            {result.success && !hasTickets && (
              <Card className="p-6 bg-gradient-card border-card-border">
                <div className="text-center py-8">
                  <Ticket className="w-16 h-16 text-muted-foreground/30 mx-auto mb-4" />
                  <h3 className="text-lg font-semibold text-foreground mb-2">
                    No se encontraron boletos
                  </h3>
                  <p className="text-muted-foreground text-sm">
                    No hay compras registradas para este número de teléfono.
                    <br />
                    Verifica que el número sea correcto e intenta de nuevo.
                  </p>
                </div>
              </Card>
            )}

            {/* Tickets Found */}
            {result.success && hasTickets && (
              <>
                {/* Contact Info */}
                {contact && (
                  <div className="flex items-center gap-3 mb-2">
                    <div className="w-10 h-10 rounded-full bg-secondary/20 flex items-center justify-center">
                      <span className="text-secondary font-bold text-lg">
                        {contact.name?.charAt(0)?.toUpperCase() || '?'}
                      </span>
                    </div>
                    <div>
                      <p className="font-semibold text-foreground">{contact.name}</p>
                      <p className="text-sm text-muted-foreground">
                        {tickets.length} {tickets.length === 1 ? 'orden encontrada' : 'órdenes encontradas'}
                      </p>
                    </div>
                  </div>
                )}

                {/* Ticket Cards */}
                {tickets.map((ticket) => {
                  const stateInfo = getStateInfo(ticket.state);
                  const StateIcon = stateInfo.icon;

                  return (
                    <Card
                      key={ticket.id}
                      className="p-6 bg-gradient-card border-card-border overflow-hidden"
                    >
                      {/* Header */}
                      <div className="flex items-start justify-between mb-4">
                        <div>
                          <p className="text-xs text-muted-foreground mb-1">
                            Orden #{ticket.id.slice(0, 8)}
                          </p>
                          <p className="font-bold text-xl text-foreground">
                            {formatCurrency(ticket.amount, ticket.currency)}
                          </p>
                        </div>
                        <Badge className={`${stateInfo.className} flex items-center gap-1`}>
                          <StateIcon className="w-3 h-3" />
                          {stateInfo.label}
                        </Badge>
                      </div>

                      {/* Date */}
                      <div className="flex items-center gap-2 text-sm text-muted-foreground mb-4">
                        <Clock className="w-4 h-4" />
                        {formatDate(ticket.date)}
                      </div>

                      {/* Elements/Items */}
                      {ticket.elements.length > 0 && (
                        <div className="mb-4 border-t border-card-border pt-4">
                          {ticket.elements.map((el, idx) => (
                            <div key={idx} className="flex justify-between items-center py-1">
                              <span className="text-sm text-foreground">
                                {el.description} × {el.quantity}
                              </span>
                              <span className="text-sm font-medium text-foreground">
                                {formatCurrency(el.price)}
                              </span>
                            </div>
                          ))}
                        </div>
                      )}

                      {/* Ticket Numbers */}
                      {ticket.ticketNumbers && ticket.ticketNumbers.length > 0 && (
                        <div className="border-t border-card-border pt-4">
                          <p className="text-xs font-medium text-muted-foreground mb-2 flex items-center gap-1">
                            <Ticket className="w-3 h-3" />
                            Números de Boletos
                          </p>
                          <div className="flex flex-wrap gap-2">
                            {ticket.ticketNumbers.map((num, idx) => (
                              <span
                                key={idx}
                                className="inline-flex items-center px-3 py-1 rounded-full text-sm font-bold bg-secondary/15 text-secondary border border-secondary/30"
                              >
                                #{num}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                    </Card>
                  );
                })}
              </>
            )}
          </div>
        )}
      </main>
      <Footer />
    </div>
  );
}
