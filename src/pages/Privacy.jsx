import React from 'react';
import { Link } from 'react-router-dom';
import { Shield, ChevronLeft } from 'lucide-react';

export default function Privacy() {
  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-3xl mx-auto">
        <div className="mb-8 flex items-center justify-between">
          <Link to="/login" className="flex items-center text-green-600 hover:text-green-700 font-medium">
            <ChevronLeft className="w-5 h-5 mr-1" />
            Voltar
          </Link>
          <div className="flex items-center gap-2 text-gray-500 text-sm">
            <Shield className="w-4 h-4" />
            <span>Última atualização: 25 de Fevereiro de 2026</span>
          </div>
        </div>

        <div className="bg-white shadow-sm rounded-2xl overflow-hidden border border-gray-100">
          <div className="bg-green-600 p-8 text-white">
            <h1 className="text-3xl font-bold">Política de Privacidade</h1>
            <p className="mt-2 text-green-100">Como protegemos seus dados no DuoVet</p>
          </div>

          <div className="p-8 prose prose-green max-w-none">
            <section className="mb-8">
              <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4">1. Coleta de Informações</h2>
              <p className="text-gray-600 dark:text-gray-300 leading-relaxed">
                O DuoVet coleta informações necessárias para a prestação de serviços veterinários, incluindo dados do profissional (nome, CRMV, contato) e dados dos animais e clientes atendidos. Coletamos essas informações quando você se cadastra no aplicativo e durante o uso das funcionalidades de prontuário e agenda.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4">2. Uso dos Dados</h2>
              <p className="text-gray-600 dark:text-gray-300 leading-relaxed">
                Os dados coletados são utilizados exclusivamente para:
              </p>
              <ul className="list-disc pl-5 mt-2 text-gray-600 space-y-2">
                <li>Gerenciamento de prontuários e histórico clínico animal.</li>
                <li>Agendamento de consultas e emissão de prescrições.</li>
                <li>Gestão financeira e faturamento do profissional.</li>
                <li>Envio de notificações de retorno e avisos importantes via e-mail ou WhatsApp.</li>
              </ul>
            </section>

            <section className="mb-8">
              <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4">3. Proteção de Dados</h2>
              <p className="text-gray-600 dark:text-gray-300 leading-relaxed">
                Implementamos medidas de segurança técnicas e organizacionais para proteger suas informações contra acesso não autorizado, perda ou alteração. Seus dados de acesso são criptografados e o armazenamento segue padrões de segurança da indústria.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4">4. Integração com Google Agenda</h2>
              <p className="text-gray-600 dark:text-gray-300 leading-relaxed">
                Ao utilizar a sincronização com o Google Agenda, o DuoVet solicita acesso para visualizar, criar e editar eventos em sua agenda. Esses dados são utilizados exclusivamente para manter seus agendamentos veterinários sincronizados entre o aplicativo e sua conta pessoal do Google. Não compartilhamos nem armazenamos dados da sua conta Google além do necessário para a sincronização dos eventos.
              </p>
              <p className="text-gray-600 leading-relaxed mt-2 italic text-sm">
                O uso das informações recebidas das APIs do Google pelo DuoVet seguirá a <a href="https://developers.google.com/terms/api-services-user-data-policy" target="_blank" rel="noopener noreferrer" className="text-green-600 hover:underline">Política de Dados do Usuário dos Serviços de API do Google</a>, incluindo os requisitos de Uso Limitado.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4">5. Compartilhamento com Terceiros</h2>
              <p className="text-gray-600 dark:text-gray-300 leading-relaxed">
                Não vendemos ou alugamos seus dados pessoais. O compartilhamento ocorre apenas com serviços essenciais para o funcionamento do app, como processadores de pagamento e serviços de infraestrutura de nuvem, sempre sob contratos de confidencialidade.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4">6. Seus Direitos</h2>
              <p className="text-gray-600 dark:text-gray-300 leading-relaxed">
                Em conformidade com a LGPD, você tem o direito de acessar, corrigir ou excluir seus dados pessoais a qualquer momento através das configurações do aplicativo ou entrando em contato com nosso suporte.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4">7. Contato</h2>
              <p className="text-gray-600 dark:text-gray-300 leading-relaxed">
                Para dúvidas sobre esta política, entre em contato através do e-mail: <a href="mailto:contato@duovet.app" className="text-green-600 hover:underline">contato@duovet.app</a>
              </p>
            </section>
          </div>
        </div>
      </div>
    </div>
  );
}
