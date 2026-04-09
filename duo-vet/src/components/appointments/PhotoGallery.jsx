import React, { useState } from 'react';
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "../ui/dialog";
import { Card, CardContent } from "../ui/card";
import { Camera, Upload, Eye, Edit2, Trash2, Check } from 'lucide-react';
// import { base44 } from '../../api/base44Client';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'framer-motion';

const PHOTO_TYPES = {
  lesao: { label: 'Lesão', color: 'bg-red-100 text-red-700 border-red-200' },
  procedimento: { label: 'Procedimento', color: 'bg-blue-100 text-blue-700 border-blue-200' },
  evolucao: { label: 'Evolução', color: 'bg-green-100 text-green-700 border-green-200' },
  outro: { label: 'Outro', color: 'bg-gray-100 text-gray-700 border-gray-200' }
};
const PHOTO_TARGET_BYTES = 48 * 1024;
const PHOTO_INITIAL_QUALITY = 0.76;
const PHOTO_MIN_QUALITY = 0.35;
const PHOTO_MAX_DIMENSION = 960;

export default function PhotoGallery({ photos = [], onChange, readonly = false }) {
  const [isUploading, setIsUploading] = useState(false);
  const [viewPhoto, setViewPhoto] = useState(null);
  const [editPhoto, setEditPhoto] = useState(null);
  const [deletePhoto, setDeletePhoto] = useState(null);
  const resolvePhotoUrl = (photo) => photo?.url || photo?.file_url || photo?.photo_url || '';
  const resolvePhotoKey = (photo, index = 0) => String(photo?.id || photo?._id || resolvePhotoUrl(photo) || `${photo?.timestamp || ''}-${index}`);
  const normalizePhoto = (photo = {}) => ({
    ...photo,
    url: resolvePhotoUrl(photo)
  });
  const readFileAsDataUrl = (file) =>
    new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  const estimateDataUrlBytes = (dataUrl) => {
    if (typeof dataUrl !== 'string') return 0;
    const base64 = dataUrl.split(',')[1];
    if (!base64) return 0;
    return Math.ceil((base64.length * 3) / 4);
  };
  const loadImageElement = (src) =>
    new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = reject;
      img.src = src;
    });
  const compressFileToDataUrl = async (file) => {
    const originalDataUrl = await readFileAsDataUrl(file);
    if (estimateDataUrlBytes(originalDataUrl) <= PHOTO_TARGET_BYTES) {
      return originalDataUrl;
    }
    const image = await loadImageElement(originalDataUrl);
    let width = image.width;
    let height = image.height;
    const maxSide = Math.max(width, height);
    if (maxSide > PHOTO_MAX_DIMENSION) {
      const scale = PHOTO_MAX_DIMENSION / maxSide;
      width = Math.max(1, Math.round(width * scale));
      height = Math.max(1, Math.round(height * scale));
    }
    let bestResult = originalDataUrl;
    let bestSize = estimateDataUrlBytes(bestResult);
    for (let pass = 0; pass < 4; pass++) {
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (!ctx) break;
      ctx.drawImage(image, 0, 0, width, height);
      for (let quality = PHOTO_INITIAL_QUALITY; quality >= PHOTO_MIN_QUALITY; quality -= 0.1) {
        const candidate = canvas.toDataURL('image/jpeg', quality);
        const candidateSize = estimateDataUrlBytes(candidate);
        if (candidateSize < bestSize) {
          bestResult = candidate;
          bestSize = candidateSize;
        }
        if (candidateSize <= PHOTO_TARGET_BYTES) {
          return candidate;
        }
      }
      width = Math.max(1, Math.round(width * 0.82));
      height = Math.max(1, Math.round(height * 0.82));
    }
    return bestResult;
  };

  const handleFileSelect = async (e) => {
    const files = Array.from(e.target.files);
    if (files.length === 0) return;

    setIsUploading(true);
    try {
      const uploadedPhotos = [];
      for (const file of files) {
        const dataUrl = await compressFileToDataUrl(file);
        uploadedPhotos.push({
          url: dataUrl,
          caption: '',
          photo_type: 'outro',
          timestamp: new Date().toISOString(),
          include_in_report: true
        });
      }
      onChange([...photos.map(normalizePhoto), ...uploadedPhotos]);
      toast.success(`${files.length} foto(s) adicionada(s)`);
    } catch (error) {
      toast.error('Erro ao fazer upload das fotos');
    } finally {
      setIsUploading(false);
      e.target.value = '';
    }
  };

  const handleUpdatePhoto = () => {
    if (!editPhoto) return;
    const editKey = resolvePhotoKey(editPhoto);
    const updatedPhotos = photos.map(p => 
      resolvePhotoKey(p) === editKey ? normalizePhoto(editPhoto) : normalizePhoto(p)
    );
    onChange(updatedPhotos);
    setEditPhoto(null);
    toast.success('Foto atualizada');
  };

  const handleDeletePhoto = () => {
    if (!deletePhoto) return;
    const deleteKey = resolvePhotoKey(deletePhoto);
    const updatedPhotos = photos.filter(p => resolvePhotoKey(p) !== deleteKey).map(normalizePhoto);
    onChange(updatedPhotos);
    setDeletePhoto(null);
    toast.success('Foto excluída');
  };

  const toggleIncludeInReport = (photoKey) => {
    const updatedPhotos = photos.map(p =>
      resolvePhotoKey(p) === photoKey ? { ...normalizePhoto(p), include_in_report: !p.include_in_report } : normalizePhoto(p)
    );
    onChange(updatedPhotos);
  };

  return (
    <div className="space-y-4">
      {/* Upload Section */}
      {!readonly && (
        <div className="flex gap-2">
          <label className="flex-1">
            <input
              type="file"
              accept="image/*"
              multiple
              onChange={handleFileSelect}
              className="hidden"
              disabled={isUploading}
            />
            <Button
              type="button"
              variant="outline"
              className="w-full rounded-xl gap-2"
              disabled={isUploading}
              asChild
            >
              <span>
                <Upload className="w-4 h-4" />
                {isUploading ? 'Enviando...' : 'Escolher Fotos'}
              </span>
            </Button>
          </label>

          <label className="flex-1">
            <input
              type="file"
              accept="image/*"
              capture="environment"
              onChange={handleFileSelect}
              className="hidden"
              disabled={isUploading}
            />
            <Button
              type="button"
              className="w-full rounded-xl gap-2 bg-[var(--accent)] hover:bg-[var(--accent-hover)]"
              disabled={isUploading}
              asChild
            >
              <span>
                <Camera className="w-4 h-4" />
                Tirar Foto
              </span>
            </Button>
          </label>
        </div>
      )}

      {/* Photo Grid */}
      {photos.length > 0 ? (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
          <AnimatePresence>
            {photos.map((photo, index) => {
              const photoKey = resolvePhotoKey(photo, index);
              const photoUrl = resolvePhotoUrl(photo);
              const typeConfig = PHOTO_TYPES[photo.photo_type] || PHOTO_TYPES.outro;
              
              return (
                <motion.div
                  key={photoKey}
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.9 }}
                  className="relative group"
                >
                  <Card className="overflow-hidden hover:shadow-lg transition-shadow">
                    <CardContent className="p-0">
                      <div className="aspect-square relative">
                        <img
                          src={photoUrl}
                          alt={photo.caption || `Foto ${index + 1}`}
                          className="w-full h-full object-cover"
                        />
                        
                        {/* Overlay Actions */}
                        <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                          <Button
                            size="icon"
                            variant="secondary"
                            className="rounded-full"
                            onClick={() => setViewPhoto(normalizePhoto(photo))}
                          >
                            <Eye className="w-4 h-4" />
                          </Button>
                          {!readonly && (
                            <>
                              <Button
                                size="icon"
                                variant="secondary"
                                className="rounded-full"
                                onClick={() => setEditPhoto(normalizePhoto(photo))}
                              >
                                <Edit2 className="w-4 h-4" />
                              </Button>
                              <Button
                                size="icon"
                                variant="destructive"
                                className="rounded-full"
                                onClick={() => setDeletePhoto(normalizePhoto(photo))}
                              >
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            </>
                          )}
                        </div>

                        {/* Type Badge */}
                        <div className={`absolute top-2 left-2 px-2 py-0.5 rounded-full text-xs font-medium border ${typeConfig.color}`}>
                          {typeConfig.label}
                        </div>

                        {/* Include in Report Toggle */}
                        {!readonly && (
                          <button
                            onClick={() => toggleIncludeInReport(photoKey)}
                            className={`absolute top-2 right-2 w-6 h-6 rounded-full flex items-center justify-center transition-all ${
                              photo.include_in_report
                                ? 'bg-[var(--accent)] text-white'
                                : 'bg-white/80 text-gray-400'
                            }`}
                            title={photo.include_in_report ? 'Incluir no relatório' : 'Não incluir no relatório'}
                          >
                            <Check className="w-4 h-4" />
                          </button>
                        )}
                      </div>

                      {/* Caption */}
                      {photo.caption && (
                        <div className="p-2 text-xs text-[var(--text-secondary)] line-clamp-2">
                          {photo.caption}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>
      ) : (
        <div className="text-center py-12 bg-[var(--bg-tertiary)] rounded-xl border-2 border-dashed border-[var(--border-color)]">
          <Camera className="w-12 h-12 text-[var(--text-muted)] mx-auto mb-3" />
          <p className="text-[var(--text-muted)]">Nenhuma foto adicionada</p>
        </div>
      )}

      {/* View Photo Dialog */}
      <Dialog open={!!viewPhoto} onOpenChange={() => setViewPhoto(null)}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle>Visualização da Foto</DialogTitle>
          </DialogHeader>
          {viewPhoto && (
            <div className="space-y-4">
              <img
                src={resolvePhotoUrl(viewPhoto)}
                alt={viewPhoto.caption || 'Foto'}
                className="w-full rounded-xl"
              />
              {viewPhoto.caption && (
                <div className="p-3 bg-[var(--bg-tertiary)] rounded-xl">
                  <p className="text-sm text-[var(--text-primary)]">{viewPhoto.caption}</p>
                </div>
              )}
              <div className="flex gap-2 text-sm text-[var(--text-muted)]">
                <span className={`px-2 py-1 rounded-lg border ${PHOTO_TYPES[viewPhoto.photo_type]?.color}`}>
                  {PHOTO_TYPES[viewPhoto.photo_type]?.label}
                </span>
                <span>
                  {new Date(viewPhoto.timestamp).toLocaleString('pt-BR')}
                </span>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Edit Photo Dialog */}
      <Dialog open={!!editPhoto} onOpenChange={() => setEditPhoto(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editar Informações da Foto</DialogTitle>
          </DialogHeader>
          {editPhoto && (
            <div className="space-y-4">
              <div className="aspect-video relative rounded-xl overflow-hidden">
                <img
                  src={resolvePhotoUrl(editPhoto)}
                  alt="Preview"
                  className="w-full h-full object-cover"
                />
              </div>

              <div>
                <Label>Tipo de Imagem</Label>
                <select
                  value={editPhoto.photo_type}
                  onChange={(e) => setEditPhoto({ ...editPhoto, photo_type: e.target.value })}
                  className="w-full h-10 px-3 rounded-xl bg-[var(--bg-card)] border border-[var(--border-color)] text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
                >
                  {Object.entries(PHOTO_TYPES).map(([key, { label }]) => (
                    <option key={key} value={key}>{label}</option>
                  ))}
                </select>
              </div>

              <div>
                <Label>Legenda (opcional)</Label>
                <Input
                  value={editPhoto.caption}
                  onChange={(e) => setEditPhoto({ ...editPhoto, caption: e.target.value })}
                  placeholder="Descreva a imagem..."
                  className="rounded-xl"
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditPhoto(null)} className="rounded-xl bg-white border border-black text-black hover:bg-gray-100">
              Cancelar
            </Button>
            <Button onClick={handleUpdatePhoto} className="rounded-xl bg-white border border-[#22c55e] hover:bg-[#22c55e] text-black">
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={!!deletePhoto} onOpenChange={() => setDeletePhoto(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Excluir Foto</DialogTitle>
          </DialogHeader>
          <p className="text-[var(--text-secondary)]">
            Tem certeza que deseja excluir esta foto? Esta ação não pode ser desfeita.
          </p>
          {deletePhoto && (
            <div className="aspect-video relative rounded-xl overflow-hidden">
              <img
                src={resolvePhotoUrl(deletePhoto)}
                alt="Preview"
                className="w-full h-full object-cover"
              />
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeletePhoto(null)} className="rounded-xl bg-white border border-black text-black hover:bg-gray-100">
              Cancelar
            </Button>
            <Button variant="destructive" onClick={handleDeletePhoto} className="rounded-xl">
              Excluir
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
