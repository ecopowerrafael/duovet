import React from 'react';
import { Link } from 'react-router-dom';
import { FileText, ChevronLeft } from 'lucide-react';

export default function Termos() {
  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-3xl mx-auto">
        <div className="mb-8 flex items-center justify-between">
          <Link to="/login" className="flex items-center text-green-600 hover:text-green-700 font-medium">
            <ChevronLeft className="w-5 h-5 mr-1" />
            Voltar
          </Link>
          <div className="flex items-center gap-2 text-gray-500 text-sm">
            <FileText className="w-4 h-4" />
            <span>Vigente a partir de: 25 de Fevereiro de 2026</span>
          </div>
        </div>

        <div className="bg-white shadow-sm rounded-2xl overflow-hidden border border-gray-100">
          <div className="bg-green-600 p-8 text-white">
            <h1 className="text-3xl font-bold">Termos de Uso</h1>
            <p className="mt-2 text-green-100">Regras para utilização da plataforma DuoVet</p>
          </div>

          <div className="p-8 prose prose-green max-w-none">
            <section className="mb-8">
              <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4">1. Aceitação dos Termos</h2>
              <p className="text-gray-600 dark:text-gray-300 leading-relaxed">
                Ao acessar e utilizar o DuoVet, você concorda em cumprir estes termos. O aplicativo é destinado a profissionais da medicina veterinária devidamente registrados em seus respectivos conselhos de classe.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4">2. Licença de Uso</h2>
              <p className="text-gray-600 dark:text-gray-300 leading-relaxed">
                Concedemos uma licença limitada, não exclusiva e intransferível para uso do sistema. Você é responsável por manter a confidencialidade de sua senha e por todas as atividades que ocorrem em sua conta.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4">3. Responsabilidade Profissional</h2>
              <p className="text-gray-600 dark:text-gray-300 leading-relaxed">
                O DuoVet é uma ferramenta de suporte. Todas as decisões clínicas, diagnósticos e tratamentos registrados no sistema são de inteira responsabilidade do médico veterinário responsável, seguindo o Código de Ética Profissional.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4">4. Assinatura e Pagamentos</h2>
              <p className="text-gray-600 dark:text-gray-300 leading-relaxed">
                O acesso total às funcionalidades depende de uma assinatura ativa. O atraso no pagamento poderá resultar na suspensão temporária do acesso aos dados, respeitando os prazos legais de guarda de documentos.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4">5. Propriedade Intelectual</h2>
              <p className="text-gray-600 dark:text-gray-300 leading-relaxed">
                Todo o conteúdo do aplicativo (software, design, logotipos) é de propriedade exclusiva do DuoVet. É proibida a reprodução, engenharia reversa ou uso indevido da marca.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4">6. Limitação de Responsabilidade</h2>
              <p className="text-gray-600 dark:text-gray-300 leading-relaxed">
                Não nos responsabilizamos por danos indiretos, perda de dados decorrente de mau uso do usuário ou interrupções de serviço causadas por terceiros (como provedores de internet).
              </p>
            </section>

            <section>
              <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4">7. Alterações nos Termos</h2>
              <p className="text-gray-600 dark:text-gray-300 leading-relaxed">
                Reservamo-nos o direito de atualizar estes termos periodicamente. Notificaremos os usuários sobre mudanças significativas através do aplicativo ou e-mail cadastrado.
              </p>
            </section>
          </div>
        </div>
      </div>
    </div>
  );
}
