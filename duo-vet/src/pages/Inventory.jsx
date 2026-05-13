import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { 
  Package, 
  Plus, 
  Search, 
  ArrowUpRight, 
  ArrowDownLeft, 
  AlertTriangle,
  MoreVertical,
  Pencil,
  Trash2,
  RotateCw
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Badge } from "../components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "../components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "../components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../components/ui/select";
import { Textarea } from "../components/ui/textarea";
import { toast } from 'sonner';
import { motion } from 'framer-motion';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

const safeFormatDate = (dateStr, formatStr = 'dd/MM/yyyy') => {
  try {
    if (!dateStr) return 'Data não informada';
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return 'Data inválida';
    return format(date, formatStr, { locale: ptBR });
  } catch (e) {
    return 'Erro na data';
  }
};

import { offlineFetch, enqueueMutation } from '../lib/offline';
import { useAuth } from '../lib/AuthContextJWT';
import { compareIds, digitsOnly, formatCurrency, formatNumberDigits, parseCurrency } from '../lib/utils';

const toNumber = (value) => {
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0;
  if (typeof value !== 'string') return 0;
  const raw = value.trim();
  if (!raw) return 0;
  let normalized = raw.replace(/\s/g, '').replace(/[^\d,.-]/g, '');
  const hasComma = normalized.includes(',');
  const hasDot = normalized.includes('.');
  if (hasComma && hasDot) {
    if (normalized.lastIndexOf(',') > normalized.lastIndexOf('.')) {
      normalized = normalized.replace(/\./g, '').replace(',', '.');
    } else {
      normalized = normalized.replace(/,/g, '');
    }
  } else if (hasComma) {
    normalized = normalized.replace(',', '.');
  }
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : 0;
};

const formatDisplayCurrency = (value) => {
  const num = toNumber(value);
  if (!Number.isFinite(num) || num <= 0) return '';
  return num.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

export default function Inventory() {
  const [activeTab, setActiveTab] = useState('products'); // 'products' or 'movements'
  const [searchTerm, setSearchTerm] = useState('');
  const [isProductDialogOpen, setIsProductDialogOpen] = useState(false);
  const [isMovementDialogOpen, setIsMovementDialogOpen] = useState(false);
  const [isCategoryDialogOpen, setIsCategoryDialogOpen] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [editingProduct, setEditingProduct] = useState(null);
  const [selectedProduct, setSelectedProduct] = useState(null);

  const [productFormData, setProductFormData] = useState({
    name: '',
    description: '',
    category: '',
    unit: '',
    minimum_stock: '',
    cost_price: '',
    sale_price: ''
  });

  const [movementFormData, setMovementFormData] = useState({
    product_id: '',
    type: 'in',
    quantity: '',
    reason: '',
    date: new Date().toISOString().split('T')[0]
  });

  const queryClient = useQueryClient();
  const { user } = useAuth();

  const { data: products = [], isLoading: isLoadingProducts, refetch: refetchProducts, isRefetching: isRefetchingProducts } = useQuery({
    queryKey: ['products', user?.email],
    queryFn: async () => {
      const email = user?.email;
      const isAdmin = email === 'admin@duovet.app';
      return offlineFetch(`/api/inventory/products?created_by=${isAdmin ? '' : (email || '')}`);
    },
    enabled: !!user?.email
  });

  const { data: movements = [], isLoading: isLoadingMovements, refetch: refetchMovements, isRefetching: isRefetchingMovements } = useQuery({
    queryKey: ['movements', user?.email],
    queryFn: async () => {
      const email = user?.email;
      const isAdmin = email === 'admin@duovet.app';
      return offlineFetch(`/api/inventory/movements?created_by=${isAdmin ? '' : (email || '')}`);
    },
    enabled: !!user?.email
  });

  const { data: categories = [], refetch: refetchCategories } = useQuery({
    queryKey: ['inventory-categories', user?.email],
    queryFn: async () => {
      const email = user?.email;
      const isAdmin = email === 'admin@duovet.app';
      return offlineFetch(`/api/inventory/categories?created_by=${isAdmin ? '' : (email || '')}`);
    },
    enabled: !!user?.email
  });

  const handleManualRefresh = async () => {
    toast.promise(
      Promise.all([
        refetchProducts(),
        refetchMovements(),
        refetchCategories()
      ]),
      {
        loading: 'Atualizando estoque...',
        success: 'Estoque atualizado com sucesso!',
        error: 'Erro ao atualizar estoque'
      }
    );
  };

  const isRefetching = isRefetchingProducts || isRefetchingMovements;

  const productMutation = useMutation({
    mutationFn: async (data) => {
      const method = editingProduct ? 'PUT' : 'POST';
      const url = editingProduct 
        ? `/api/inventory/products/${editingProduct.id}` 
        : '/api/inventory/products';
      
      return enqueueMutation(url, {
        method,
        body: { ...data, created_by: user?.email }
      });
    },
    onSuccess: async (res) => {
      await queryClient.invalidateQueries({ queryKey: ['products', user?.email] });
      toast.success(res?.queued ? 'Produto enfileirado para sincronização' : (editingProduct ? 'Produto atualizado' : 'Produto cadastrado'));
      handleCloseProductDialog();
    }
  });

  const movementMutation = useMutation({
    mutationFn: async (data) => {
      return enqueueMutation('/api/inventory/movements', {
        method: 'POST',
        body: { ...data, created_by: user?.email }
      });
    },
    onSuccess: async (res) => {
      await queryClient.invalidateQueries({ queryKey: ['products', user?.email] });
      await queryClient.invalidateQueries({ queryKey: ['movements', user?.email] });
      toast.success(res?.queued ? 'Movimentação enfileirada para sincronização' : 'Movimentação registrada');
      handleCloseMovementDialog();
    }
  });

  const deleteProductMutation = useMutation({
    mutationFn: async (id) => {
      return enqueueMutation(`/api/inventory/products/${id}`, {
        method: 'DELETE'
      });
    },
    onSuccess: async (res) => {
      await queryClient.invalidateQueries({ queryKey: ['products', user?.email] });
      toast.success(res?.queued ? 'Exclusão enfileirada para sincronização' : 'Produto excluído');
    }
  });

  const categoryMutation = useMutation({
    mutationFn: async (name) => {
      return enqueueMutation('/api/inventory/categories', {
        method: 'POST',
        body: { name, created_by: user?.email }
      });
    },
    onSuccess: async (res) => {
      await queryClient.invalidateQueries({ queryKey: ['inventory-categories', user?.email] });
      toast.success(res?.queued ? 'Categoria enfileirada para sincronização' : 'Categoria adicionada');
      setIsCategoryDialogOpen(false);
      setNewCategoryName('');
    }
  });

  const handleOpenProductDialog = (product = null) => {
    if (product) {
      setEditingProduct(product);
      setProductFormData({
        name: product.name,
        description: product.description || '',
        category: product.category || '',
        unit: product.unit || 'un',
        minimum_stock: formatNumberDigits(product.minimum_stock?.toString() || ''),
        cost_price: formatCurrency(product.cost_price || 0),
        sale_price: formatCurrency(product.sale_price || 0)
      });
    } else {
      setEditingProduct(null);
      setProductFormData({
        name: '',
        description: '',
        category: '',
        unit: 'un',
        minimum_stock: '',
        cost_price: '',
        sale_price: ''
      });
    }
    setIsProductDialogOpen(true);
  };

  const handleCloseProductDialog = () => {
    setIsProductDialogOpen(false);
    setEditingProduct(null);
  };

  const handleOpenMovementDialog = (product = null, type = 'in') => {
    setMovementFormData({
      product_id: product?.id?.toString() || '',
      type,
      quantity: '',
      reason: '',
      date: new Date().toISOString().split('T')[0]
    });
    setSelectedProduct(product);
    setIsMovementDialogOpen(true);
  };

  const handleCloseMovementDialog = () => {
    setIsMovementDialogOpen(false);
    setSelectedProduct(null);
  };

  const handleProductSubmit = (e) => {
    e.preventDefault();
    productMutation.mutate({
      ...productFormData,
      minimum_stock: Number(digitsOnly(productFormData.minimum_stock)) || 0,
      cost_price: parseCurrency(productFormData.cost_price),
      sale_price: parseCurrency(productFormData.sale_price)
    });
  };

  const handleMovementSubmit = (e) => {
    e.preventDefault();
    movementMutation.mutate({
      ...movementFormData,
      product_id: parseInt(movementFormData.product_id),
      quantity: Number(digitsOnly(movementFormData.quantity)) || 0
    });
  };

  const filteredProducts = products.filter(p => 
    p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    p.category?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const sortedMovements = [...movements].sort((a, b) => {
    try {
      const dateB = b?.date ? new Date(b.date).getTime() : 0;
      const dateA = a?.date ? new Date(a.date).getTime() : 0;
      return dateB - dateA;
    } catch (e) {
      return 0;
    }
  });

  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <Package className="w-6 h-6 text-[#22c55e]" />
            Estoque e Insumos
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Gerencie seus medicamentos, vacinas e materiais
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button 
            onClick={handleManualRefresh}
            variant="outline"
            disabled={isRefetching}
            className={`border-gray-200 dark:border-slate-800 text-gray-700 dark:text-gray-300 gap-2 h-10 px-4 rounded-xl font-medium ${isRefetching ? 'animate-pulse' : ''}`}
          >
            <RotateCw className={`w-4 h-4 ${isRefetching ? 'animate-spin' : ''}`} />
            Sincronizar
          </Button>
          <Button 
            onClick={() => handleOpenProductDialog()}
            className="bg-[#22c55e] hover:bg-[#1eb054] text-white rounded-xl h-10 px-4"
          >
            <Plus className="w-4 h-4 mr-2" />
            Novo Produto
          </Button>
        </div>
      </div>

      <div className="flex border-b border-gray-200 dark:border-gray-800">
        <button
          onClick={() => setActiveTab('products')}
          className={`px-4 py-2 font-medium text-sm transition-colors relative ${
            activeTab === 'products' 
              ? 'text-[#22c55e]' 
              : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
          }`}
        >
          Produtos
          {activeTab === 'products' && (
            <motion.div 
              layoutId="activeTab" 
              className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#22c55e]" 
            />
          )}
        </button>
        <button
          onClick={() => setActiveTab('movements')}
          className={`px-4 py-2 font-medium text-sm transition-colors relative ${
            activeTab === 'movements' 
              ? 'text-[#22c55e]' 
              : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
          }`}
        >
          Histórico de Movimentações
          {activeTab === 'movements' && (
            <motion.div 
              layoutId="activeTab" 
              className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#22c55e]" 
            />
          )}
        </button>
      </div>

      {activeTab === 'products' ? (
        <div className="space-y-4">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <Input
                placeholder="Buscar produtos ou categorias..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 rounded-xl bg-white dark:bg-slate-900 border-gray-200 dark:border-slate-800"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredProducts.map((product) => (
              <motion.div
                key={product.id || product._id}
                layout
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
              >
                <Card className="overflow-hidden hover:shadow-md transition-shadow dark:bg-slate-900 border-gray-200 dark:border-slate-800">
                  <CardHeader className="p-4 pb-2">
                    <div className="flex justify-between items-start">
                      <div className="space-y-1">
                        <CardTitle className="text-lg font-bold truncate">
                          {product.name}
                        </CardTitle>
                        <Badge variant="outline" className="text-[10px] uppercase tracking-wider">
                          {product.category || 'Sem Categoria'}
                        </Badge>
                      </div>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8">
                            <MoreVertical className="w-4 h-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => handleOpenProductDialog(product)}>
                            <Pencil className="w-4 h-4 mr-2" />
                            Editar
                          </DropdownMenuItem>
                          <DropdownMenuItem 
                            className="text-red-600"
                            onClick={() => {
                              if (confirm('Deseja realmente excluir este produto?')) {
                                deleteProductMutation.mutate(product.id);
                              }
                            }}
                          >
                            <Trash2 className="w-4 h-4 mr-2" />
                            Excluir
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </CardHeader>
                  <CardContent className="p-4 pt-0 space-y-4">
                    <div className="flex items-end justify-between">
                      <div className="space-y-1">
                        <span className="text-xs text-gray-500 uppercase">Estoque Atual</span>
                        <div className="flex items-baseline gap-1">
                          <span className={`text-2xl font-bold ${
                            parseFloat(product.current_stock || 0) <= parseFloat(product.minimum_stock || 0) 
                              ? 'text-red-500' 
                              : 'text-gray-900 dark:text-white'
                          }`}>
                            {product.current_stock || 0}
                          </span>
                          <span className="text-sm text-gray-500">{product.unit}</span>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <Button 
                          size="sm" 
                          variant="outline" 
                          className="h-8 w-8 p-0 rounded-lg border-green-200 text-green-600 hover:bg-green-50"
                          onClick={() => handleOpenMovementDialog(product, 'in')}
                        >
                          <ArrowUpRight className="w-4 h-4" />
                        </Button>
                        <Button 
                          size="sm" 
                          variant="outline" 
                          className="h-8 w-8 p-0 rounded-lg border-red-200 text-red-600 hover:bg-red-50"
                          onClick={() => handleOpenMovementDialog(product, 'out')}
                        >
                          <ArrowDownLeft className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>

                    {parseFloat(product.current_stock || 0) <= parseFloat(product.minimum_stock || 0) && (
                      <div className="flex items-center gap-2 p-2 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 rounded-lg text-xs">
                        <AlertTriangle className="w-3 h-3" />
                        Estoque baixo! Mínimo: {product.minimum_stock || 0} {product.unit}
                      </div>
                    )}

                    <div className="grid grid-cols-2 gap-2 pt-2 border-t border-gray-100 dark:border-gray-800">
                      <div>
                        <span className="text-[10px] text-gray-500 uppercase block">Custo</span>
                        <span className="text-sm font-medium">
                          R$ {parseFloat(product.cost_price || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                        </span>
                      </div>
                      <div>
                        <span className="text-[10px] text-gray-500 uppercase block">Venda</span>
                        <span className="text-sm font-medium">
                          R$ {parseFloat(product.sale_price || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                        </span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>
        </div>
      ) : (
        <Card className="dark:bg-slate-900 border-gray-200 dark:border-slate-800">
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="text-xs text-gray-500 uppercase bg-gray-50 dark:bg-slate-800/50">
                <tr>
                  <th className="px-6 py-3 font-medium">Data</th>
                  <th className="px-6 py-3 font-medium">Produto</th>
                  <th className="px-6 py-3 font-medium">Tipo</th>
                  <th className="px-6 py-3 font-medium">Qtd</th>
                  <th className="px-6 py-3 font-medium">Motivo</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                {(sortedMovements || []).map((movement) => {
                  const product = (products || []).find(p => p && compareIds(p.id || p._id, movement.product_id));
                  return (
                    <tr key={movement.id || movement._id} className="hover:bg-gray-50 dark:hover:bg-slate-800/30 transition-colors">
                      <td className="px-6 py-4 whitespace-nowrap text-gray-500">
                        {safeFormatDate(movement.date, "dd/MM/yyyy HH:mm")}
                      </td>
                      <td className="px-6 py-4 font-medium text-gray-900 dark:text-white">
                        {product?.name || 'Produto Excluído'}
                      </td>
                      <td className="px-6 py-4">
                        <Badge 
                          variant="outline" 
                          className={movement.type === 'in' 
                            ? 'bg-green-50 text-green-700 border-green-100' 
                            : 'bg-red-50 text-red-700 border-red-100'
                          }
                        >
                          {movement.type === 'in' ? 'Entrada' : 'Saída'}
                        </Badge>
                      </td>
                      <td className="px-6 py-4 font-semibold">
                        {movement.type === 'in' ? '+' : '-'}{movement.quantity} {product?.unit}
                      </td>
                      <td className="px-6 py-4 text-gray-500">
                        {movement.reason || '-'}
                      </td>
                    </tr>
                  );
                })}
                {movements.length === 0 && (
                  <tr>
                    <td colSpan="5" className="px-6 py-12 text-center text-gray-500 italic">
                      Nenhuma movimentação registrada.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* Dialog Produto */}
      <Dialog open={isProductDialogOpen} onOpenChange={setIsProductDialogOpen}>
        <DialogContent className="sm:max-w-[500px] rounded-2xl">
          <DialogHeader>
            <DialogTitle>{editingProduct ? 'Editar Produto' : 'Novo Produto'}</DialogTitle>
            <DialogDescription>
              {editingProduct ? 'Altere as informações do produto abaixo.' : 'Preencha as informações para cadastrar um novo produto no estoque.'}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleProductSubmit} className="space-y-4 pt-4">
            <div className="space-y-2">
              <Label htmlFor="name">Nome do Produto *</Label>
              <Input
                id="name"
                required
                value={productFormData.name}
                onChange={(e) => setProductFormData({...productFormData, name: e.target.value})}
                placeholder="Ex: Vacina contra raiva"
                className="rounded-xl"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="category">Categoria</Label>
                <div className="flex gap-2">
                  <Select 
                    value={productFormData.category} 
                    onValueChange={(val) => setProductFormData({...productFormData, category: val})}
                  >
                    <SelectTrigger className="rounded-xl flex-1">
                      <SelectValue placeholder="Selecione ou crie" />
                    </SelectTrigger>
                    <SelectContent>
                      {categories.map((cat) => (
                        <SelectItem key={cat.id || cat.name} value={cat.name}>
                          {cat.name}
                        </SelectItem>
                      ))}
                      {categories.length === 0 && (
                        <div className="p-2 text-xs text-gray-500 italic text-center">
                          Nenhuma categoria salva
                        </div>
                      )}
                    </SelectContent>
                  </Select>
                  <Button 
                    type="button" 
                    variant="outline" 
                    size="icon" 
                    className="rounded-xl shrink-0"
                    onClick={() => setIsCategoryDialogOpen(true)}
                  >
                    <Plus className="w-4 h-4" />
                  </Button>
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="unit">Unidade</Label>
                <Select 
                  value={productFormData.unit} 
                  onValueChange={(val) => setProductFormData({...productFormData, unit: val})}
                >
                  <SelectTrigger className="rounded-xl">
                    <SelectValue placeholder="Selecione" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="un">Unidade (un)</SelectItem>
                    <SelectItem value="ml">Mililitro (ml)</SelectItem>
                    <SelectItem value="l">Litro (l)</SelectItem>
                    <SelectItem value="kg">Quilo (kg)</SelectItem>
                    <SelectItem value="g">Grama (g)</SelectItem>
                    <SelectItem value="dose">Dose</SelectItem>
                    <SelectItem value="frasco">Frasco</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="min_stock">Estoque Mín.</Label>
                <Input
                  id="min_stock"
                  type="text"
                  value={productFormData.minimum_stock}
                  onChange={(e) => setProductFormData({...productFormData, minimum_stock: formatNumberDigits(e.target.value)})}
                  placeholder="0"
                  className="rounded-xl"
                  inputMode="numeric"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="cost">Custo (R$)</Label>
                <Input
                  id="cost"
                  type="text"
                  value={productFormData.cost_price}
                  onChange={(e) => setProductFormData({...productFormData, cost_price: formatDisplayCurrency(e.target.value)})}
                  placeholder="R$ 0,00"
                  className="rounded-xl"
                  inputMode="numeric"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="sale">Venda (R$)</Label>
                <Input
                  id="sale"
                  type="text"
                  value={productFormData.sale_price}
                  onChange={(e) => setProductFormData({...productFormData, sale_price: formatDisplayCurrency(e.target.value)})}
                  placeholder="R$ 0,00"
                  className="rounded-xl"
                  inputMode="numeric"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="desc">Descrição</Label>
              <Textarea
                id="desc"
                value={productFormData.description}
                onChange={(e) => setProductFormData({...productFormData, description: e.target.value})}
                placeholder="Detalhes adicionais sobre o produto..."
                className="rounded-xl"
                rows={3}
              />
            </div>
            <DialogFooter className="pt-4">
              <Button type="button" variant="ghost" onClick={handleCloseProductDialog} className="bg-white border border-black text-black hover:bg-gray-100 rounded-xl dark:bg-slate-800 dark:border-slate-600 dark:text-slate-100 dark:hover:bg-slate-700">
                Cancelar
              </Button>
              <Button type="submit" className="bg-white border border-[#22c55e] hover:bg-[#22c55e] text-black rounded-xl dark:bg-slate-800 dark:text-slate-100 dark:hover:bg-[#22c55e]/90">
                {editingProduct ? 'Atualizar' : 'Cadastrar'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Dialog Categoria */}
      <Dialog open={isCategoryDialogOpen} onOpenChange={setIsCategoryDialogOpen}>
        <DialogContent className="sm:max-w-[400px] rounded-2xl">
          <DialogHeader>
            <DialogTitle>Nova Categoria</DialogTitle>
            <DialogDescription>
              Crie uma nova categoria para organizar seus produtos.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 pt-4">
            <div className="space-y-2">
              <Label htmlFor="new-category">Nome da Categoria</Label>
              <Input
                id="new-category"
                value={newCategoryName}
                onChange={(e) => setNewCategoryName(e.target.value)}
                placeholder="Ex: Antibióticos, Instrumentos..."
                className="rounded-xl"
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && newCategoryName.trim()) {
                    categoryMutation.mutate(newCategoryName.trim());
                  }
                }}
              />
            </div>
            <DialogFooter>
              <Button variant="ghost" onClick={() => setIsCategoryDialogOpen(false)} className="bg-white border border-black text-black hover:bg-gray-100 rounded-xl dark:bg-slate-800 dark:border-slate-600 dark:text-slate-100 dark:hover:bg-slate-700">
                Cancelar
              </Button>
              <Button 
                onClick={() => categoryMutation.mutate(newCategoryName.trim())}
                disabled={!newCategoryName.trim() || categoryMutation.isLoading}
                className="bg-white border border-[#22c55e] hover:bg-[#22c55e] text-black rounded-xl dark:bg-slate-800 dark:text-slate-100 dark:hover:bg-[#22c55e]/90"
              >
                {categoryMutation.isLoading ? 'Salvando...' : 'Salvar'}
              </Button>
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>

      {/* Dialog Movimentação */}
      <Dialog open={isMovementDialogOpen} onOpenChange={setIsMovementDialogOpen}>
        <DialogContent className="sm:max-w-[450px] rounded-2xl">
          <DialogHeader>
            <DialogTitle>
              {movementFormData.type === 'in' ? 'Entrada de Estoque' : 'Saída de Estoque'}
            </DialogTitle>
            <DialogDescription>
              Produto: {selectedProduct?.name}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleMovementSubmit} className="space-y-4 pt-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="qty">Quantidade ({selectedProduct?.unit}) *</Label>
                <Input
                  id="qty"
                  type="text"
                  required
                  autoFocus
                  value={movementFormData.quantity}
                  onChange={(e) => setMovementFormData({...movementFormData, quantity: formatNumberDigits(e.target.value)})}
                  placeholder="0"
                  className="rounded-xl"
                  inputMode="numeric"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="date">Data</Label>
                <Input
                  id="date"
                  type="date"
                  required
                  value={movementFormData.date}
                  onChange={(e) => setMovementFormData({...movementFormData, date: e.target.value})}
                  className="rounded-xl"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="reason">Motivo / Observação</Label>
              <Input
                id="reason"
                value={movementFormData.reason}
                onChange={(e) => setMovementFormData({...movementFormData, reason: e.target.value})}
                placeholder={movementFormData.type === 'in' ? 'Ex: Compra com fornecedor X' : 'Ex: Uso em atendimento'}
                className="rounded-xl"
              />
            </div>
            <DialogFooter className="pt-4">
              <Button type="button" variant="ghost" onClick={handleCloseMovementDialog} className="bg-white border border-black text-black hover:bg-gray-100 rounded-xl dark:bg-slate-800 dark:border-slate-600 dark:text-slate-100 dark:hover:bg-slate-700">
                Cancelar
              </Button>
              <Button 
                type="submit" 
                className="rounded-xl bg-white border border-[#22c55e] hover:bg-[#22c55e] text-black dark:bg-slate-800 dark:text-slate-100 dark:hover:bg-[#22c55e]/90"
              >
                Confirmar {movementFormData.type === 'in' ? 'Entrada' : 'Saída'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
