/**
 * Interface para resposta da API ViaCEP
 */
export interface CepData {
  cep: string;
  logradouro: string;
  complemento: string;
  bairro: string;
  localidade: string;
  uf: string;
  erro?: boolean;
}

/**
 * Serviço para consulta de CEP usando ViaCEP
 */
export class CepService {
  private static readonly BASE_URL = 'https://viacep.com.br/ws';

  /**
   * Consulta CEP e retorna dados do endereço
   * @param cep CEP a ser consultado (com ou sem formatação)
   * @returns Dados do endereço ou null se não encontrado
   */
  static async consultarCep(cep: string): Promise<CepData | null> {
    try {
      // Remove formatação do CEP
      const cepLimpo = cep.replace(/\D/g, '');

      // Valida formato do CEP
      if (cepLimpo.length !== 8) {
        console.warn('[CepService] CEP inválido:', cep);
        return null;
      }

      // Faz requisição para ViaCEP
      const response = await fetch(`${this.BASE_URL}/${cepLimpo}/json/`);

      if (!response.ok) {
        console.error('[CepService] Erro na requisição:', response.status);
        return null;
      }

      const data: CepData = await response.json();

      // ViaCEP retorna { erro: true } quando CEP não existe
      if (data.erro) {
        console.warn('[CepService] CEP não encontrado:', cep);
        return null;
      }

      console.info('[CepService] CEP consultado com sucesso:', cepLimpo);
      return data;

    } catch (error) {
      console.error('[CepService] Erro ao consultar CEP:', error);
      return null;
    }
  }

  /**
   * Formata dados do ViaCEP para o formato do formulário
   * @param cepData Dados retornados do ViaCEP
   * @returns Objeto com campos do formulário preenchidos
   */
  static formatarParaFormulario(cepData: CepData) {
    return {
      address: cepData.logradouro || '',
      neighborhood: cepData.bairro || '',
      city: cepData.localidade || '',
      state: cepData.uf || '',
      complement: cepData.complemento || '',
    };
  }
}
