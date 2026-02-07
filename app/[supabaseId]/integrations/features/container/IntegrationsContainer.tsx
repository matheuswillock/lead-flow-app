"use client";

import { useEffect, useMemo, useState } from "react";
import { useIntegrationContext } from "../context/IntegrationContext";
import { useTeamContext } from "@/app/context/TeamContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";

export function IntegrationsContainer() {
  const {
    metaIntegration,
    whatsAppIntegration,
    teamMembers,
    isLoading,
    error,
    saveMetaIntegration,
    saveWhatsAppIntegration,
    testMetaIntegration,
    testWhatsAppIntegration
  } = useIntegrationContext();
  const { activeTeamId } = useTeamContext();

  const [metaForm, setMetaForm] = useState({
    pageId: "",
    pageAccessToken: "",
    verifyToken: "",
    defaultAssigneeId: "",
    isActive: false
  });

  const [whatsAppForm, setWhatsAppForm] = useState({
    phoneNumberId: "",
    accessToken: "",
    verifyToken: "",
    businessAccountId: "",
    businessPhoneNumber: "",
    isActive: false
  });

  useEffect(() => {
    setMetaForm((prev) => ({
      ...prev,
      pageId: metaIntegration?.pageId || "",
      verifyToken: metaIntegration?.verifyToken || "",
      defaultAssigneeId: metaIntegration?.defaultAssigneeId || "",
      isActive: metaIntegration?.isActive ?? false,
      pageAccessToken: ""
    }));
  }, [metaIntegration]);

  useEffect(() => {
    setWhatsAppForm((prev) => ({
      ...prev,
      phoneNumberId: whatsAppIntegration?.phoneNumberId || "",
      verifyToken: whatsAppIntegration?.verifyToken || "",
      businessAccountId: whatsAppIntegration?.businessAccountId || "",
      businessPhoneNumber: whatsAppIntegration?.businessPhoneNumber || "",
      isActive: whatsAppIntegration?.isActive ?? false,
      accessToken: ""
    }));
  }, [whatsAppIntegration]);

  const membersOptions = useMemo(() => {
    return teamMembers.map((member) => ({
      value: member.id,
      label: `${member.name} (${member.role})`
    }));
  }, [teamMembers]);

  async function handleSaveMeta() {
    try {
      const payload: any = {
        pageId: metaForm.pageId,
        verifyToken: metaForm.verifyToken,
        teamId: activeTeamId,
        defaultAssigneeId: metaForm.defaultAssigneeId || null,
        isActive: metaForm.isActive
      };

      if (metaForm.pageAccessToken) {
        payload.pageAccessToken = metaForm.pageAccessToken;
      }

      await saveMetaIntegration(payload);
      toast.success("Integração Meta salva com sucesso");
    } catch (err: any) {
      toast.error(err?.message || "Erro ao salvar integração Meta");
    }
  }

  async function handleTestMeta() {
    const result = await testMetaIntegration(metaForm.pageId || null);
    if (result) {
      toast.success(`Conexao validada. Formularios: ${result.totalForms}`);
    } else {
      toast.error("Falha ao testar integração Meta");
    }
  }

  async function handleSaveWhatsApp() {
    try {
      const payload: any = {
        phoneNumberId: whatsAppForm.phoneNumberId,
        verifyToken: whatsAppForm.verifyToken,
        businessAccountId: whatsAppForm.businessAccountId || null,
        businessPhoneNumber: whatsAppForm.businessPhoneNumber || null,
        teamId: activeTeamId,
        isActive: whatsAppForm.isActive
      };

      if (whatsAppForm.accessToken) {
        payload.accessToken = whatsAppForm.accessToken;
      }

      await saveWhatsAppIntegration(payload);
      toast.success("Integração WhatsApp salva com sucesso");
    } catch (err: any) {
      toast.error(err?.message || "Erro ao salvar integração WhatsApp");
    }
  }

  async function handleTestWhatsApp() {
    const result = await testWhatsAppIntegration(whatsAppForm.phoneNumberId || null);
    if (result) {
      toast.success("Conexao WhatsApp validada");
    } else {
      toast.error("Falha ao testar integração WhatsApp");
    }
  }

  return (
    <div className="space-y-6">
      {error ? (
        <Card className="border-destructive/50">
          <CardContent className="p-4 text-sm text-destructive">{error}</CardContent>
        </Card>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>Meta Lead Ads</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="meta-page-id">Page ID</Label>
              <Input
                id="meta-page-id"
                value={metaForm.pageId}
                onChange={(event) => setMetaForm((prev) => ({ ...prev, pageId: event.target.value }))}
                placeholder="123456789"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="meta-verify-token">Verify Token</Label>
              <Input
                id="meta-verify-token"
                value={metaForm.verifyToken}
                onChange={(event) => setMetaForm((prev) => ({ ...prev, verifyToken: event.target.value }))}
                placeholder="token-de-verificacao"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="meta-access-token">Page Access Token</Label>
              <Input
                id="meta-access-token"
                value={metaForm.pageAccessToken}
                onChange={(event) => setMetaForm((prev) => ({ ...prev, pageAccessToken: event.target.value }))}
                placeholder="Cole o token atualizado"
              />
            </div>
            <div className="space-y-2">
              <Label>Responsavel Padrao</Label>
              <Select
                value={metaForm.defaultAssigneeId}
                onValueChange={(value) => setMetaForm((prev) => ({ ...prev, defaultAssigneeId: value }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecionar" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">Sem atribuição</SelectItem>
                  {membersOptions.map((member) => (
                    <SelectItem key={member.value} value={member.value}>
                      {member.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="flex items-center justify-between rounded-lg border p-3">
            <div>
              <p className="text-sm font-medium">Integração ativa</p>
              <p className="text-xs text-muted-foreground">Quando ativa, o webhook cria leads automaticamente.</p>
            </div>
            <Switch
              checked={metaForm.isActive}
              onCheckedChange={(value) => setMetaForm((prev) => ({ ...prev, isActive: value }))}
            />
          </div>

          <div className="flex flex-wrap gap-3">
            <Button onClick={handleSaveMeta} disabled={isLoading}>
              {metaIntegration ? "Atualizar" : "Salvar"}
            </Button>
            <Button variant="outline" onClick={handleTestMeta} disabled={isLoading}>
              Testar conexao
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>WhatsApp Cloud API</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="wa-phone-id">Phone Number ID</Label>
              <Input
                id="wa-phone-id"
                value={whatsAppForm.phoneNumberId}
                onChange={(event) => setWhatsAppForm((prev) => ({ ...prev, phoneNumberId: event.target.value }))}
                placeholder="123456789"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="wa-verify-token">Verify Token</Label>
              <Input
                id="wa-verify-token"
                value={whatsAppForm.verifyToken}
                onChange={(event) => setWhatsAppForm((prev) => ({ ...prev, verifyToken: event.target.value }))}
                placeholder="token-de-verificacao"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="wa-access-token">Access Token</Label>
              <Input
                id="wa-access-token"
                value={whatsAppForm.accessToken}
                onChange={(event) => setWhatsAppForm((prev) => ({ ...prev, accessToken: event.target.value }))}
                placeholder="Cole o token atualizado"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="wa-business-account">Business Account ID</Label>
              <Input
                id="wa-business-account"
                value={whatsAppForm.businessAccountId}
                onChange={(event) => setWhatsAppForm((prev) => ({ ...prev, businessAccountId: event.target.value }))}
                placeholder="Opcional"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="wa-business-phone">Telefone de exibicao</Label>
              <Input
                id="wa-business-phone"
                value={whatsAppForm.businessPhoneNumber}
                onChange={(event) => setWhatsAppForm((prev) => ({ ...prev, businessPhoneNumber: event.target.value }))}
                placeholder="Opcional"
              />
            </div>
          </div>

          <div className="flex items-center justify-between rounded-lg border p-3">
            <div>
              <p className="text-sm font-medium">Integração ativa</p>
              <p className="text-xs text-muted-foreground">Quando ativa, o bot responde mensagens.</p>
            </div>
            <Switch
              checked={whatsAppForm.isActive}
              onCheckedChange={(value) => setWhatsAppForm((prev) => ({ ...prev, isActive: value }))}
            />
          </div>

          <div className="flex flex-wrap gap-3">
            <Button onClick={handleSaveWhatsApp} disabled={isLoading}>
              {whatsAppIntegration ? "Atualizar" : "Salvar"}
            </Button>
            <Button variant="outline" onClick={handleTestWhatsApp} disabled={isLoading}>
              Testar conexao
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
