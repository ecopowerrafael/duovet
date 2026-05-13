// API utilitário para chamadas ao backend com suporte offline
import { offlineFetch, enqueueMutation } from './offline';
export async function getSettings() {
  return await offlineFetch('/api/settings');
}

export async function updateSettings(data) {
  return await enqueueMutation('/api/settings', { method: 'PUT', body: data });
}

export async function getUsers() {
  return await offlineFetch('/api/users');
}

export async function updateUser(id, data) {
  return await enqueueMutation(`/api/users/${id}`, { method: 'PUT', body: data });
}

export async function deactivateUser(id) {
  return await enqueueMutation(`/api/users/${id}`, { method: 'DELETE' });
}

export async function getSubscriptions() {
  return await offlineFetch('/api/subscriptions');
}

export async function updateSubscription(id, data) {
  return await enqueueMutation(`/api/subscriptions/${id}`, { method: 'PUT', body: data });
}

export async function changePassword(currentPassword, newPassword) {
  return await enqueueMutation('/api/auth/change-password', {
    method: 'POST',
    body: { currentPassword, newPassword }
  });
}

export async function adminChangeUserPassword(userId, newPassword) {
  return await enqueueMutation(`/api/users/${userId}/change-password`, {
    method: 'POST',
    body: { newPassword }
  });
}

export async function forgotPassword(email) {
  return await enqueueMutation('/api/auth/forgot-password', {
    method: 'POST',
    body: { email }
  });
}

export async function resetPassword(token, newPassword) {
  return await enqueueMutation('/api/auth/reset-password', {
    method: 'POST',
    body: { token, newPassword }
  });
}

export async function getGlobalSettings() {
  return await offlineFetch('/api/settings?user_id=null');
}

export async function updateGlobalSettings(data) {
  return await enqueueMutation('/api/settings?user_id=null', {
    method: 'PUT',
    body: data
  });
}

export async function sendNotification(data) {
  return await enqueueMutation('/api/notifications', {
    method: 'POST',
    body: data
  });
}

export async function broadcastNotification(data) {
  return await enqueueMutation('/api/notifications/broadcast', {
    method: 'POST',
    body: data
  });
}

export async function activateUserSubscription(userId, billingPeriod, plan) {
  return await enqueueMutation(`/api/users/${userId}/activate-subscription`, {
    method: 'POST',
    body: { billing_period: billingPeriod, plan }
  });
}

export async function getAffiliateMe() {
  return await offlineFetch('/api/affiliates/me');
}

export async function updateAffiliatePix(pix_key) {
  return await enqueueMutation('/api/affiliates/me/pix', { method: 'PUT', body: { pix_key } });
}

export async function getAffiliateReferrals() {
  return await offlineFetch('/api/affiliates/me/referrals');
}

export async function getAffiliatePayouts() {
  return await offlineFetch('/api/affiliates/me/payouts');
}

export async function requestAffiliatePayout(amount) {
  return await enqueueMutation('/api/affiliates/me/payouts', { method: 'POST', body: { amount } });
}

export async function getAffiliateAdminPayoutRequests(status = 'requested') {
  return await offlineFetch(`/api/affiliates/admin/payout-requests?status=${encodeURIComponent(status)}`);
}

export async function completeAffiliatePayoutRequest(id) {
  return await enqueueMutation(`/api/affiliates/admin/payout-requests/${id}/complete`, { method: 'POST', body: {} });
}

export async function rejectAffiliatePayoutRequest(id, note) {
  return await enqueueMutation(`/api/affiliates/admin/payout-requests/${id}/reject`, { method: 'POST', body: { note } });
}

export async function getAffiliateAdminUserProfile(userId) {
  return await offlineFetch(`/api/affiliates/admin/users/${userId}/profile`);
}

export async function setAffiliateCustomCommission(userId, custom_commission) {
  return await enqueueMutation(`/api/affiliates/admin/users/${userId}/custom-commission`, { method: 'PUT', body: { custom_commission } });
}

export async function getAffiliateTopAffiliates(limit = 10) {
  return await offlineFetch(`/api/affiliates/admin/performance/top?limit=${encodeURIComponent(limit)}`);
}

export async function getAffiliateConversions(days = 30) {
  return await offlineFetch(`/api/affiliates/admin/performance/conversions?days=${encodeURIComponent(days)}`);
}
