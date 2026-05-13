import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ 
        hasAccess: false, 
        reason: 'not_authenticated' 
      }, { status: 401 });
    }

    // Buscar membro da organização
    const [member] = await base44.entities.OrganizationMember.filter({ user_id: user.id });
    
    if (!member) {
      return Response.json({
        hasAccess: false,
        reason: 'no_organization',
        message: 'Usuário não pertence a nenhuma organização'
      });
    }

    // Buscar organização
    const [organization] = await base44.entities.Organization.filter({ id: member.organization_id });
    
    if (!organization) {
      return Response.json({
        hasAccess: false,
        reason: 'organization_not_found'
      });
    }

    // Verificar se está bloqueado
    if (organization.blocked_at) {
      return Response.json({
        hasAccess: false,
        blocked: true,
        reason: 'blocked',
        message: organization.blocked_reason || 'Acesso bloqueado',
        organization
      });
    }

    // Verificar status da assinatura
    const now = new Date();
    const trialEnd = new Date(organization.trial_end_date);

    // Em trial
    if (organization.subscription_status === 'trial') {
      if (now > trialEnd) {
        // Trial expirado - bloquear
        await base44.asServiceRole.entities.Organization.update(organization.id, {
          subscription_status: 'expired',
          blocked_at: new Date().toISOString(),
          blocked_reason: 'Período de teste expirado'
        });

        return Response.json({
          hasAccess: false,
          blocked: true,
          reason: 'trial_expired',
          trialEndDate: organization.trial_end_date,
          daysRemaining: 0,
          message: 'Seu período de teste gratuito expirou. Assine um plano para continuar.',
          organization
        });
      }

      // Trial ativo
      const daysRemaining = Math.ceil((trialEnd - now) / (1000 * 60 * 60 * 24));
      
      return Response.json({
        hasAccess: true,
        inTrial: true,
        trialEndDate: organization.trial_end_date,
        daysRemaining,
        organization,
        member
      });
    }

    // Assinatura ativa
    if (organization.subscription_status === 'active') {
      return Response.json({
        hasAccess: true,
        inTrial: false,
        organization,
        member
      });
    }

    // Expirado ou cancelado
    if (organization.subscription_status === 'expired' || organization.subscription_status === 'cancelled') {
      return Response.json({
        hasAccess: false,
        blocked: true,
        reason: organization.subscription_status,
        message: 'Assinatura inativa. Renove seu plano para continuar.',
        organization
      });
    }

    return Response.json({
      hasAccess: false,
      reason: 'unknown',
      organization
    });

  } catch (error) {
    console.error('Erro ao verificar acesso:', error);
    return Response.json({
      error: 'Erro ao verificar acesso',
      details: error.message
    }, { status: 500 });
  }
});