'use client';

// app/subscribe/features/components/SubscriptionForm.tsx
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Loader2, CreditCard, Smartphone, Barcode } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { subscriptionSchema, type SubscriptionFormSchema } from '../validation/subscriptionSchema';
import { SubscriptionService } from '../services/SubscriptionService';

interface SubscriptionFormProps {
  onSuccess: (customerId: string, subscriptionId: string, paymentUrl?: string, pix?: { encodedImage: string; payload: string; expirationDate: string }, paymentId?: string) => void;
  onError: (error: string) => void;
}

export function SubscriptionForm({ onSuccess, onError }: SubscriptionFormProps) {
  const [loading, setLoading] = useState(false);
  const [billingType, setBillingType] = useState<'CREDIT_CARD' | 'PIX' | 'BOLETO'>('CREDIT_CARD');
  
  const service = new SubscriptionService();

  const form = useForm<SubscriptionFormSchema>({
    resolver: zodResolver(subscriptionSchema),
    defaultValues: {
      fullName: '',
      email: '',
      cpfCnpj: '',
      phone: '',
      postalCode: '',
      address: '',
      addressNumber: '',
      complement: '',
      province: '',
      city: '',
      state: '',
      billingType: 'CREDIT_CARD',
      creditCard: {
        holderName: '',
        number: '',
        expiryMonth: '',
        expiryYear: '',
        ccv: '',
      },
    },
  });

  const onSubmit = async (data: SubscriptionFormSchema) => {
    console.info('📝 [SubscriptionForm] Enviando formulário:', {
      email: data.email,
      billingType: data.billingType,
      fullName: data.fullName
    });
    
    setLoading(true);
    
    try {
      const result = await service.createSubscription(data);
      
      console.info('📝 [SubscriptionForm] Resultado recebido:', {
        success: result.success,
        hasCustomerId: !!result.customerId,
        hasSubscriptionId: !!result.subscriptionId,
        hasPix: !!result.pix,
        hasPaymentId: !!result.paymentId,
        message: result.message
      });
      
      if (result.success) {
        console.info('📝 [SubscriptionForm] Chamando onSuccess com:', {
          customerId: result.customerId,
          subscriptionId: result.subscriptionId,
          hasPaymentUrl: !!result.paymentUrl,
          hasPix: !!result.pix,
          hasPaymentId: !!result.paymentId,
          pixKeys: result.pix ? Object.keys(result.pix) : []
        });
        
        onSuccess(
          result.customerId!,
          result.subscriptionId!,
          result.paymentUrl,
          result.pix,
          result.paymentId,
        );
      } else {
        onError(result.message);
      }
    } catch (error: any) {
      console.error('❌ [SubscriptionForm] Erro ao enviar:', error);
      onError(error.message || 'Erro ao processar assinatura');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
        {/* Dados Pessoais */}
        <div className="rounded-lg border bg-card p-6">
          <h3 className="text-lg font-semibold mb-4">Dados Pessoais</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <FormField
              control={form.control}
              name="fullName"
              render={({ field }) => (
                <FormItem className="md:col-span-2">
                  <FormLabel>Nome Completo</FormLabel>
                  <FormControl>
                    <Input placeholder="João Silva" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Email</FormLabel>
                  <FormControl>
                    <Input type="email" placeholder="joao@example.com" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="cpfCnpj"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>CPF/CNPJ</FormLabel>
                  <FormControl>
                    <Input placeholder="000.000.000-00" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="phone"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Telefone</FormLabel>
                  <FormControl>
                    <Input placeholder="(11) 99999-9999" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
        </div>

        {/* Endereço */}
        <div className="rounded-lg border bg-card p-6">
          <h3 className="text-lg font-semibold mb-4">Endereço</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <FormField
              control={form.control}
              name="postalCode"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>CEP</FormLabel>
                  <FormControl>
                    <Input placeholder="00000-000" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="address"
              render={({ field }) => (
                <FormItem className="md:col-span-2">
                  <FormLabel>Endereço</FormLabel>
                  <FormControl>
                    <Input placeholder="Rua Example" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="addressNumber"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Número</FormLabel>
                  <FormControl>
                    <Input placeholder="123" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="complement"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Complemento (Opcional)</FormLabel>
                  <FormControl>
                    <Input placeholder="Apto 45" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="province"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Bairro</FormLabel>
                  <FormControl>
                    <Input placeholder="Centro" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="city"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Cidade</FormLabel>
                  <FormControl>
                    <Input placeholder="São Paulo" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="state"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Estado (UF)</FormLabel>
                  <FormControl>
                    <Input placeholder="SP" maxLength={2} {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
        </div>

        {/* Forma de Pagamento */}
        <div className="rounded-lg border bg-card p-6">
          <h3 className="text-lg font-semibold mb-4">Forma de Pagamento</h3>
          
          <FormField
            control={form.control}
            name="billingType"
            render={({ field }) => (
              <FormItem>
                <FormControl>
                  <ToggleGroup
                    type="single"
                    value={field.value}
                    onValueChange={(value) => {
                      if (value) {
                        field.onChange(value);
                        setBillingType(value as typeof billingType);
                      }
                    }}
                    className="grid grid-cols-3 gap-4"
                  >
                    <ToggleGroupItem
                      value="CREDIT_CARD"
                      className="flex flex-col items-center gap-2 h-auto py-4 data-[state=on]:bg-primary data-[state=on]:text-primary-foreground"
                    >
                      <CreditCard className="h-6 w-6" />
                      <span className="text-sm font-medium">Cartão de Crédito</span>
                    </ToggleGroupItem>
                    
                    <ToggleGroupItem
                      value="PIX"
                      className="flex flex-col items-center gap-2 h-auto py-4 data-[state=on]:bg-primary data-[state=on]:text-primary-foreground"
                    >
                      <Smartphone className="h-6 w-6" />
                      <span className="text-sm font-medium">PIX</span>
                    </ToggleGroupItem>
                    
                    <ToggleGroupItem
                      value="BOLETO"
                      className="flex flex-col items-center gap-2 h-auto py-4 data-[state=on]:bg-primary data-[state=on]:text-primary-foreground"
                    >
                      <Barcode className="h-6 w-6" />
                      <span className="text-sm font-medium">Boleto</span>
                    </ToggleGroupItem>
                  </ToggleGroup>
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          {/* Dados do Cartão de Crédito */}
          {billingType === 'CREDIT_CARD' && (
            <div className="mt-6 space-y-4">
              <FormField
                control={form.control}
                name="creditCard.holderName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Nome no Cartão</FormLabel>
                    <FormControl>
                      <Input placeholder="JOÃO SILVA" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="creditCard.number"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Número do Cartão</FormLabel>
                    <FormControl>
                      <Input placeholder="0000 0000 0000 0000" maxLength={16} {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="grid grid-cols-3 gap-4">
                <FormField
                  control={form.control}
                  name="creditCard.expiryMonth"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Mês</FormLabel>
                      <FormControl>
                        <Input placeholder="MM" maxLength={2} {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="creditCard.expiryYear"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Ano</FormLabel>
                      <FormControl>
                        <Input placeholder="YYYY" maxLength={4} {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="creditCard.ccv"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>CVV</FormLabel>
                      <FormControl>
                        <Input placeholder="000" maxLength={4} {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </div>
          )}
        </div>

        {/* Submit Button */}
        <div className="flex justify-end">
          <Button
            type="submit"
            size="lg"
            disabled={loading}
            className="min-w-[200px]"
          >
            {loading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Processando...
              </>
            ) : (
              'Confirmar Assinatura'
            )}
          </Button>
        </div>
      </form>
    </Form>
  );
}
