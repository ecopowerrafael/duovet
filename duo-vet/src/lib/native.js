import { Camera, CameraResultType, CameraSource } from '@capacitor/camera';
import { PushNotifications } from '@capacitor/push-notifications';
import { Geolocation } from '@capacitor/geolocation';
import { Network } from '@capacitor/network';
import { Device } from '@capacitor/device';
import { App } from '@capacitor/app';
import { Browser } from '@capacitor/browser';
import { Haptics, ImpactStyle, NotificationType } from '@capacitor/haptics';

/**
 * Utilitários para funções nativas via Capacitor
 */

export const Native = {
  // Feedback tátil
  async vibrate(type = 'impact') {
    try {
      const info = await this.getDeviceInfo();
      if (info.platform === 'web') return;

      if (type === 'success') {
        await Haptics.notification({ type: NotificationType.Success });
      } else if (type === 'error') {
        await Haptics.notification({ type: NotificationType.Error });
      } else if (type === 'warning') {
        await Haptics.notification({ type: NotificationType.Warning });
      } else {
        await Haptics.impact({ style: ImpactStyle.Medium });
      }
    } catch (e) {
      // Ignorar se falhar
    }
  },

  // Tirar foto com a câmera ou escolher da galeria
  async takePhoto() {
    try {
      const image = await Camera.getPhoto({
        quality: 90,
        allowEditing: false,
        resultType: CameraResultType.Base64,
        source: CameraSource.Prompt, // Pergunta se quer câmera ou galeria
        promptLabelHeader: 'Selecionar Foto',
        promptLabelPhoto: 'Da Galeria',
        promptLabelPicture: 'Tirar Foto'
      });
      return image.base64String;
    } catch (error) {
      console.error('Error taking photo:', error);
      return null;
    }
  },

  // Obter localização atual
  async getCurrentPosition() {
    try {
      const coordinates = await Geolocation.getCurrentPosition();
      return coordinates;
    } catch (error) {
      console.error('Error getting position:', error);
      return null;
    }
  },

  // Verificar status da conexão
  async getNetworkStatus() {
    const status = await Network.getStatus();
    return status;
  },

  // Registrar para notificações push
  async registerPush() {
    try {
      let permStatus = await PushNotifications.checkPermissions();
      if (permStatus.receive === 'prompt') {
        permStatus = await PushNotifications.requestPermissions();
      }
      if (permStatus.receive !== 'granted') {
        throw new Error('Permissão de notificação negada');
      }
      await PushNotifications.register();
    } catch (error) {
      console.error('Error registering push:', error);
    }
  },

  // Abrir link no navegador nativo
  async openUrl(url) {
    await Browser.open({ url });
  },

  // Obter informações do dispositivo
  async getDeviceInfo() {
    return await Device.getInfo();
  },

  // Fechar o app (Android)
  async exitApp() {
    App.exitApp();
  }
};

// Listener para mudanças na rede
Network.addListener('networkStatusChange', status => {
  console.log('Network status changed', status);
});
