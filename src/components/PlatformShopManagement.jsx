import React, { useState, useEffect } from 'react';
import { toast } from 'react-toastify';
import { qualityAPI } from '../api';
import Modal from './Modal';
import PlatformShopForm from './PlatformShopForm';

const PlatformShopManagement = () => {
    const [platforms, setPlatforms] = useState([]);
    const [loading, setLoading] = useState(true);
    const [isPlatformModalOpen, setIsPlatformModalOpen] = useState(false);
    const [isShopModalOpen, setIsShopModalOpen] = useState(false);
    const [editingPlatform, setEditingPlatform] = useState(null);
    const [editingShop, setEditingShop] = useState(null);
    const [selectedPlatform, setSelectedPlatform] = useState(null); // Used to know which platform to add a shop to

    useEffect(() => {
        loadPlatforms();
    }, []);

    const loadPlatforms = async () => {
        try {
            setLoading(true);
            const response = await qualityAPI.getPlatforms();
            const platformsWithShops = await Promise.all(
                (response.data.data || []).map(async (platform) => {
                    const shopResponse = await qualityAPI.getShopsByPlatform(platform.id);
                    return { ...platform, shops: shopResponse.data.data || [] };
                })
            );
            setPlatforms(platformsWithShops);
        } catch (error) {
            toast.error('加载平台和店铺数据失败');
        } finally {
            setLoading(false);
        }
    };
    
    // Platform Handlers
    const handleAddPlatform = () => {
        setEditingPlatform(null);
        setIsPlatformModalOpen(true);
    };

    const handleEditPlatform = (platform) => {
        setEditingPlatform(platform);
        setIsPlatformModalOpen(true);
    };

    const handleDeletePlatform = async (id) => {
        if (window.confirm('确定要删除这个平台吗？其下的所有店铺也将被删除。')) {
            try {
                await qualityAPI.deletePlatform(id);
                toast.success('平台删除成功！');
                loadPlatforms();
            } catch (error) {
                toast.error('平台删除失败');
            }
        }
    };

    const handleSavePlatform = async (platformData) => {
        try {
            if (editingPlatform) {
                await qualityAPI.updatePlatform(editingPlatform.id, platformData);
                toast.success('平台更新成功！');
            } else {
                await qualityAPI.createPlatform(platformData);
                toast.success('平台添加成功！');
            }
            setIsPlatformModalOpen(false);
            loadPlatforms();
        } catch (error) {
             toast.error(editingPlatform ? '平台更新失败' : '平台添加失败');
        }
    };

    // Shop Handlers
    const handleAddShop = (platform) => {
        setSelectedPlatform(platform);
        setEditingShop(null);
        setIsShopModalOpen(true);
    };

    const handleEditShop = (shop, platform) => {
        setSelectedPlatform(platform);
        setEditingShop(shop);
        setIsShopModalOpen(true);
    };

    const handleDeleteShop = async (id) => {
        if (window.confirm('确定要删除这个店铺吗？')) {
            try {
                await qualityAPI.deleteShop(id);
                toast.success('店铺删除成功！');
                loadPlatforms(); // Reload all data
            } catch (error) {
                toast.error('店铺删除失败');
            }
        }
    };

    const handleSaveShop = async (shopData) => {
        try {
            const dataToSave = { ...shopData, platform_id: selectedPlatform.id };
            if (editingShop) {
                await qualityAPI.updateShop(editingShop.id, dataToSave);
                toast.success('店铺更新成功！');
            } else {
                await qualityAPI.createShop(dataToSave);
                toast.success('店铺添加成功！');
            }
            setIsShopModalOpen(false);
            loadPlatforms(); // Reload all data
        } catch (error) {
            toast.error(editingShop ? '店铺更新失败' : '店铺添加失败');
        }
    };

    if (loading) {
        return <div className="text-center p-8">加载中...</div>;
    }

    return (
        <div className="p-8">
            <div className="flex justify-between items-center mb-6">
                <h2 className="text-2xl font-bold text-gray-800">平台与店铺管理</h2>
                <button
                    onClick={handleAddPlatform}
                    className="px-6 py-2.5 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors shadow-md"
                >
                    添加新平台
                </button>
            </div>

            <div className="space-y-8">
                {platforms.map(platform => (
                    <div key={platform.id} className="bg-white rounded-xl shadow-md p-6">
                        <div className="flex justify-between items-center mb-4 pb-4 border-b">
                            <h3 className="text-xl font-bold text-gray-800">{platform.name}</h3>
                            <div className="flex items-center gap-3">
                                <button onClick={() => handleEditPlatform(platform)} className="text-sm font-medium text-blue-600 hover:text-blue-800">编辑平台</button>
                                <button onClick={() => handleDeletePlatform(platform.id)} className="text-sm font-medium text-red-600 hover:text-red-800">删除平台</button>
                                <button onClick={() => handleAddShop(platform)} className="text-sm font-medium text-white bg-green-600 px-4 py-2 rounded-lg hover:bg-green-700 shadow-sm">添加店铺</button>
                            </div>
                        </div>
                        <table className="w-full">
                            <thead>
                                <tr className="bg-gray-50">
                                    <th className="px-4 py-3 text-left text-sm font-semibold text-gray-600 rounded-tl-lg">店铺名称</th>
                                    <th className="px-4 py-3 text-right text-sm font-semibold text-gray-600 rounded-tr-lg">操作</th>
                                </tr>
                            </thead>
                            <tbody>
                                {platform.shops && platform.shops.length > 0 ? (
                                    platform.shops.map(shop => (
                                        <tr key={shop.id} className="border-b hover:bg-gray-50/50">
                                            <td className="px-4 py-3 text-gray-700">{shop.name}</td>
                                            <td className="px-4 py-3 text-right">
                                                <button onClick={() => handleEditShop(shop, platform)} className="text-sm font-medium text-blue-600 hover:underline mr-4">编辑</button>
                                                <button onClick={() => handleDeleteShop(shop.id)} className="text-sm font-medium text-red-600 hover:underline">删除</button>
                                            </td>
                                        </tr>
                                    ))
                                ) : (
                                    <tr>
                                        <td colSpan="2" className="text-center py-6 text-gray-500">该平台下暂无店铺</td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                ))}
            </div>
            
            {/* Platform Modal */}
            <Modal isOpen={isPlatformModalOpen} onClose={() => setIsPlatformModalOpen(false)} title={editingPlatform ? '编辑平台' : '添加平台'}>
                <PlatformShopForm
                    entity={editingPlatform}
                    onSave={handleSavePlatform}
                    onCancel={() => setIsPlatformModalOpen(false)}
                />
            </Modal>

            {/* Shop Modal */}
            <Modal isOpen={isShopModalOpen} onClose={() => setIsShopModalOpen(false)} title={editingShop ? `编辑店铺 (平台: ${selectedPlatform?.name})` : `添加新店铺到 ${selectedPlatform?.name}`}>
                <PlatformShopForm
                    entity={editingShop}
                    onSave={handleSaveShop}
                    onCancel={() => setIsShopModalOpen(false)}
                />
            </Modal>
        </div>
    );
};

export default PlatformShopManagement;
