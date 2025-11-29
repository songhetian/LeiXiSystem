import React, { useState, useEffect, useRef } from 'react';
import Modal from './Modal';
import { toast } from 'react-toastify';
import qualityAPI from '../api/qualityAPI.js';
import ExcelJS from 'exceljs';
import { CloudUploadOutlined } from '@ant-design/icons';

const ImportSessionModal = ({ isOpen, onClose, onSuccess }) => {
    const [currentStep, setCurrentStep] = useState(1);
    const [platforms, setPlatforms] = useState([]);
    const [shops, setShops] = useState([]);
    const [selectedPlatform, setSelectedPlatform] = useState('');
    const [selectedShop, setSelectedShop] = useState('');
    const [file, setFile] = useState(null);
    const [fileColumns, setFileColumns] = useState([]);
    const [columnMap, setColumnMap] = useState({});
    const [previewData, setPreviewData] = useState([]);
    const [isDragging, setIsDragging] = useState(false);
    const [importError, setImportError] = useState('');

    const fileInputRef = useRef(null);

    const SYSTEM_FIELDS = [
        'session_no', 'agent_name', 'customer_id', 'customer_name',
        'channel', 'start_time', 'end_time',
        'duration', 'message_count'
    ];

    const SYSTEM_FIELD_LABELS_ZH = {
        'session_no': '会话编号',
        'agent_name': '客服姓名',
        'customer_id': '客户ID',
        'customer_name': '客户姓名',
        'channel': '沟通渠道',
        'start_time': '开始时间',
        'end_time': '结束时间',
        'duration': '时长(秒)',
        'message_count': '消息数量'
    };

    useEffect(() => {
        if (isOpen) {
            setCurrentStep(1);
            setSelectedPlatform('');
            setSelectedShop('');
            setFile(null);
            setFileColumns([]);
            setColumnMap({});
            setPreviewData([]);
            setImportError('');

            const fetchPlatforms = async () => {
                try {
                    const response = await qualityAPI.getPlatforms();
                    setPlatforms(response.data.data);
                } catch (error) {
                    toast.error('加载平台列表失败。');
                    setImportError('加载平台列表失败，请稍后再试。');
                }
            };
            fetchPlatforms();
        }
    }, [isOpen]);

    useEffect(() => {
        if (selectedPlatform) {
            const fetchShops = async () => {
                try {
                    const response = await qualityAPI.getShopsByPlatform(selectedPlatform);
                    setShops(response.data.data);
                    setSelectedShop('');
                } catch (error) {
                    toast.error('加载店铺列表失败。');
                    setImportError('加载店铺列表失败，请稍后再试。');
                }
            };
            fetchShops();
        } else {
            setShops([]);
        }
    }, [selectedPlatform]);

    // 智能自动映射函数
    const autoMapColumns = (headers) => {
        const mapping = {};

        // 定义映射规则：系统字段 -> 可能的Excel列名
        const mappingRules = {
            'session_no': ['会话编号', '会话号', 'session_no', 'sessionNo', '编号'],
            'agent_name': ['客服姓名', '客服名称', '客服', 'agent_name', 'agentName', '姓名'],
            'customer_id': ['客户ID', '客户编号', 'customer_id', 'customerId'],
            'customer_name': ['客户姓名', '客户名称', '客户', 'customer_name', 'customerName'],
            'channel': ['沟通渠道', '渠道', 'channel', '通道'],
            'start_time': ['开始时间', '起始时间', 'start_time', 'startTime'],
            'end_time': ['结束时间', '终止时间', 'end_time', 'endTime'],
            'duration': ['时长(秒)', '时长', 'duration', '持续时间'],
            'message_count': ['消息数量', '消息数', 'message_count', 'messageCount', '条数']
        };

        // 遍历系统字段，尝试匹配Excel列名
        Object.keys(mappingRules).forEach(systemField => {
            const possibleNames = mappingRules[systemField];
            for (const header of headers) {
                if (possibleNames.includes(header)) {
                    mapping[systemField] = header;
                    break;
                }
            }
        });

        return mapping;
    };

    const processFile = async (selectedFile) => {
        setImportError('');
        if (!selectedFile) return;

        setFile(selectedFile);
        const workbook = new ExcelJS.Workbook();
        const reader = new FileReader();
        reader.readAsArrayBuffer(selectedFile);
        reader.onload = async () => {
            try {
                const buffer = reader.result;
                await workbook.xlsx.load(buffer);
                const worksheet = workbook.getWorksheet(1);
                if (!worksheet) {
                    throw new Error('Excel文件中未找到工作表。');
                }
                const headerRow = worksheet.getRow(1);
                if (!headerRow || headerRow.actualCellCount === 0) {
                    throw new Error('Excel文件缺少标题行。');
                }
                const headers = [];
                headerRow.eachCell((cell) => {
                    headers.push(cell.value);
                });
                setFileColumns(headers);

                // 自动映射列
                const autoMapping = autoMapColumns(headers);
                setColumnMap(autoMapping);

                // 显示自动映射结果
                const mappedCount = Object.keys(autoMapping).length;
                if (mappedCount > 0) {
                    toast.success(`已自动映射 ${mappedCount} 个字段`);
                }

                const rows = [];
                worksheet.eachRow((row, rowNumber) => {
                    if (rowNumber > 1 && rowNumber <= 6) {
                        const rowData = {};
                        row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
                            rowData[headers[colNumber - 1]] = cell.value;
                        });
                        rows.push(rowData);
                    }
                });
                setPreviewData(rows);
            } catch (error) {
                toast.error(`解析 Excel 文件失败：${error.message}`);
                setImportError(`解析 Excel 文件失败：${error.message}`);
                console.error(error);
                setFile(null);
                setFileColumns([]);
                setColumnMap({});
                setPreviewData([]);
            }
        };
        reader.onerror = (error) => {
            toast.error('读取文件失败。');
            setImportError('读取文件失败。');
            console.error('File reader error:', error);
            setFile(null);
            setFileColumns([]);
            setColumnMap({});
            setPreviewData([]);
        };
    };

    const handleFileChange = (e) => {
        const selectedFile = e.target.files[0];
        processFile(selectedFile);
    };

    const handleDragOver = (e) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragging(true);
    };

    const handleDragLeave = (e) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragging(false);
    };

    const handleDrop = (e) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragging(false);
        if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
            processFile(e.dataTransfer.files[0]);
            e.dataTransfer.clearData();
        }
    };

    const handleDownloadTemplate = async () => {
        const workbook = new ExcelJS.Workbook();

        // Sheet 1: 会话信息
        const sessionSheet = workbook.addWorksheet('会话信息');
        sessionSheet.columns = [
            { header: '会话编号', key: 'session_no', width: 20 },
            { header: '客服姓名', key: 'agent_name', width: 15 },
            { header: '客户ID', key: 'customer_id', width: 15 },
            { header: '客户姓名', key: 'customer_name', width: 15 },
            { header: '沟通渠道', key: 'channel', width: 12 },
            { header: '开始时间', key: 'start_time', width: 20 },
            { header: '结束时间', key: 'end_time', width: 20 },
            { header: '时长(秒)', key: 'duration', width: 12 },
            { header: '消息数量', key: 'message_count', width: 12 }
        ];

        // 添加示例数据
        sessionSheet.addRow({
            session_no: 'S001',
            agent_name: '张三',
            customer_id: 'C001',
            customer_name: '李四',
            channel: 'chat',
            start_time: '2024-11-29 10:00:00',
            end_time: '2024-11-29 10:15:00',
            duration: 900,
            message_count: 2
        });

        // Sheet 2: 聊天记录
        const messageSheet = workbook.addWorksheet('聊天记录');
        messageSheet.columns = [
            { header: '会话编号', key: 'session_no', width: 20 },
            { header: '发送者类型', key: 'sender_type', width: 15 },
            { header: '发送者姓名', key: 'sender_name', width: 15 },
            { header: '消息内容', key: 'content', width: 50 },
            { header: '发送时间', key: 'timestamp', width: 20 }
        ];

        // 添加示例消息
        messageSheet.addRow({
            session_no: 'S001',
            sender_type: 'customer',
            sender_name: '李四',
            content: '你好，我想咨询一下产品信息',
            timestamp: '2024-11-29 10:00:05'
        });

        messageSheet.addRow({
            session_no: 'S001',
            sender_type: 'agent',
            sender_name: '张三',
            content: '您好！很高兴为您服务，请问有什么可以帮您的？',
            timestamp: '2024-11-29 10:00:10'
        });

        const buffer = await workbook.xlsx.writeBuffer();
        const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = '质检会话导入模板.xlsx';
        link.click();
        URL.revokeObjectURL(link.href);
    };

    const handleColumnMapChange = (systemField, fileColumn) => {
        setColumnMap(prev => ({ ...prev, [systemField]: fileColumn }));
    };

    const handleNext = () => {
        setImportError('');
        if (currentStep === 1) {
            if (!selectedPlatform || !selectedShop) {
                const msg = '请选择平台和店铺。';
                toast.warn(msg);
                setImportError(msg);
                return;
            }
        } else if (currentStep === 2) {
            if (!file) {
                const msg = '请上传文件。';
                toast.warn(msg);
                setImportError(msg);
                return;
            }
        } else if (currentStep === 3) {
            // 只要求必填字段：会话编号和客服姓名
            const requiredFields = ['session_no', 'agent_name'];
            const missingFields = requiredFields.filter(field => !columnMap[field]);
            if (missingFields.length > 0) {
                const fieldLabels = missingFields.map(f => SYSTEM_FIELD_LABELS_ZH[f]).join('、');
                const msg = `请至少映射 ${fieldLabels}。`;
                toast.warn(msg);
                setImportError(msg);
                return;
            }
        }
        setCurrentStep(currentStep + 1);
    };

    const handleBack = () => {
        setImportError('');
        setCurrentStep(currentStep - 1);
    };

    const handleImport = async () => {
        setImportError('');
        if (!file || !selectedPlatform || !selectedShop) {
            const msg = '导入缺少必要信息。';
            toast.error(msg);
            setImportError(msg);
            return;
        }

        const formData = new FormData();
        formData.append('file', file);
        formData.append('platform', selectedPlatform);
        formData.append('shop', selectedShop);
        formData.append('columnMap', JSON.stringify(columnMap));

        try {
            const response = await qualityAPI.importSessions(formData);
            toast.success(response.data.message);
            if (onSuccess) {
                onSuccess();
            }
            onClose();
        } catch (error) {
            const msg = error.response?.data?.message || '导入失败。';
            toast.error(msg);
            setImportError(msg);
        }
    };

    const getStepClass = (step) => {
        if (currentStep === step) {
            return 'text-white bg-primary-600';
        }
        if (currentStep > step) {
            return 'text-white bg-green-500';
        }
        return 'text-gray-500 bg-gray-200';
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="导入会话">
            <div className="p-6 min-w-[600px]">
                {/* Stepper */}
                <div className="flex items-center justify-center mb-8">
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center ${getStepClass(1)}`}>
                        <span>1</span>
                    </div>
                    <div className={`flex-auto border-t-2 transition-all duration-500 ${currentStep > 1 ? 'border-primary-600' : 'border-gray-200'}`}></div>
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center ${getStepClass(2)}`}>
                        <span>2</span>
                    </div>
                    <div className={`flex-auto border-t-2 transition-all duration-500 ${currentStep > 2 ? 'border-primary-600' : 'border-gray-200'}`}></div>
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center ${getStepClass(3)}`}>
                        <span>3</span>
                    </div>
                </div>
                <div className="flex justify-around mb-4 text-sm font-medium">
                    <span className={currentStep >= 1 ? 'text-primary-700' : 'text-gray-500'}>选择平台与店铺</span>
                    <span className={currentStep >= 2 ? 'text-primary-700' : 'text-gray-500'}>上传与映射</span>
                    <span className={currentStep >= 3 ? 'text-primary-700' : 'text-gray-500'}>预览与确认</span>
                </div>

                {/* Step Content */}
                <div>
                    {importError && (
                        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative mb-4" role="alert">
                            <strong className="font-bold">导入错误：</strong>
                            <span className="block sm:inline">{importError}</span>
                        </div>
                    )}

                    {currentStep === 1 && (
                        <div className="mt-8">
                            <h3 className="text-lg font-semibold leading-6 text-gray-900 mb-6 text-center">第一步：选择平台和店铺</h3>
                            <div className="space-y-6">
                                <div>
                                    <label htmlFor="platform" className="block text-sm font-medium text-gray-700">平台</label>
                                    <select
                                        id="platform"
                                        name="platform"
                                        value={selectedPlatform}
                                        onChange={(e) => setSelectedPlatform(e.target.value)}
                                        className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-primary-500 focus:border-primary-500 sm:text-sm rounded-md shadow-sm"
                                    >
                                        <option value="">请选择平台</option>
                                        {platforms.map(p => (
                                            <option key={p.id} value={p.id}>{p.name}</option>
                                        ))}
                                    </select>
                                </div>
                                <div>
                                    <label htmlFor="shop" className="block text-sm font-medium text-gray-700">店铺</label>
                                    <select
                                        id="shop"
                                        name="shop"
                                        value={selectedShop}
                                        onChange={(e) => setSelectedShop(e.target.value)}
                                        disabled={!selectedPlatform}
                                        className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-primary-500 focus:border-primary-500 sm:text-sm rounded-md shadow-sm disabled:bg-gray-100"
                                    >
                                        <option value="">请选择店铺</option>
                                        {shops.map(s => (
                                            <option key={s.id} value={s.id}>{s.name}</option>
                                        ))}
                                    </select>
                                </div>
                            </div>
                        </div>
                    )}
                    {currentStep === 2 && (
                        <div className="mt-8">
                            <h3 className="text-lg font-semibold leading-6 text-gray-900 mb-6 text-center">第二步：上传文件并映射列</h3>
                            <div className="space-y-6">
                                <div>
                                    <label htmlFor="file-upload" className="block text-sm font-medium text-gray-700">上传 Excel 文件</label>
                                    <div
                                        className={`mt-2 flex justify-center px-6 pt-5 pb-6 border-2 rounded-md ${isDragging ? 'border-primary-500 bg-primary-50 border-solid' : 'border-gray-300 border-dashed'}`}
                                        onDragOver={handleDragOver}
                                        onDragLeave={handleDragLeave}
                                        onDrop={handleDrop}
                                    >
                                        <div className="space-y-1 text-center">
                                            <CloudUploadOutlined className="mx-auto h-12 w-12 text-gray-400" style={{ fontSize: '48px' }} />
                                            <div className="flex text-sm text-gray-600">
                                                <label htmlFor="file-upload" className="relative cursor-pointer bg-white rounded-md font-medium text-primary-600 hover:text-primary-500 focus-within:outline-none focus-within:ring-2 focus-within:ring-offset-2 focus-within:ring-primary-500">
                                                    <span>{file ? file.name : '拖拽文件到此处 或 点击上传'}</span>
                                                    <input id="file-upload" name="file-upload" type="file" accept=".xlsx, .xls" className="sr-only" onChange={handleFileChange} ref={fileInputRef} />
                                                </label>
                                            </div>
                                            <p className="text-xs text-gray-500">支持 XLSX, XLS 格式</p>
                                        </div>
                                    </div>
                                    <div className="text-center mt-4">
                                        <button onClick={handleDownloadTemplate} className="text-sm font-medium text-primary-600 hover:underline">下载模板</button>
                                    </div>
                                </div>
                                {fileColumns.length > 0 && (
                                    <div className="space-y-4">
                                        <h4 className="text-md font-medium text-gray-800">映射列</h4>
                                        {SYSTEM_FIELDS.map(field => (
                                            <div key={field} className="grid grid-cols-2 gap-4 items-center">
                                                <label className="text-sm font-medium text-gray-700">{SYSTEM_FIELD_LABELS_ZH[field] || field}</label>
                                                <select
                                                    value={columnMap[field] || ''}
                                                    onChange={(e) => handleColumnMapChange(field, e.target.value)}
                                                    className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-primary-500 focus:border-primary-500 sm:text-sm rounded-md shadow-sm"
                                                >
                                                    <option value="">选择列</option>
                                                    {fileColumns.map(col => (
                                                        <option key={col} value={col}>{col}</option>
                                                    ))}
                                                </select>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>
                    )}
                    {currentStep === 3 && (
                        <div className="mt-8">
                            <h3 className="text-lg font-semibold leading-6 text-gray-900 mb-6 text-center">第三步：预览并确认</h3>
                            <div className="space-y-2 mb-4 bg-gray-50 p-4 rounded-lg">
                                <p className="text-sm text-gray-700">
                                    <span className="font-medium">已选平台：</span> {platforms.find(p => p.id === parseInt(selectedPlatform))?.name || 'N/A'}
                                </p>
                                <p className="text-sm text-gray-700">
                                    <span className="font-medium">已选店铺：</span> {shops.find(s => s.id === parseInt(selectedShop))?.name || 'N/A'}
                                </p>
                            </div>
                            {previewData.length > 0 ? (
                                <div className="overflow-x-auto border border-gray-200 rounded-lg shadow-sm">
                                    <table className="w-full">
                                        <thead>
                                            <tr className="bg-primary-100 text-primary-800">
                                                {SYSTEM_FIELDS.map((field, index) => (
                                                    <th
                                                        key={field}
                                                        scope="col"
                                                        className={`px-4 py-3 text-left text-xs font-medium uppercase tracking-wider
                                                                ${index === 0 ? 'rounded-tl-lg' : ''}
                                                                ${index === SYSTEM_FIELDS.length - 1 ? 'rounded-tr-lg' : ''}`
                                                        }
                                                    >
                                                        {SYSTEM_FIELD_LABELS_ZH[field] || field}
                                                    </th>
                                                ))}
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {previewData.map((row, rowIndex) => (
                                                <tr key={rowIndex} className={`border-b border-primary-100
                                                        ${rowIndex % 2 === 0 ? 'bg-white' : 'bg-primary-50/30'}
                                                        hover:bg-primary-100/50 transition-colors`}>
                                                    {SYSTEM_FIELDS.map(field => (
                                                        <td key={field} className="px-4 py-3 whitespace-nowrap text-sm text-gray-700">
                                                            {row[columnMap[field]] || row[field] || ''}
                                                        </td>
                                                    ))}
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            ) : (
                                <p className="mt-4 text-center text-sm text-gray-600">无数据可预览，或文件未正确上传/解析。</p>
                            )}
                        </div>
                    )}
                </div>

                {/* Navigation */}
                <div className="mt-8 pt-5">
                    <div className="flex justify-between">
                        <button
                            onClick={handleBack}
                            disabled={currentStep === 1}
                            className="px-6 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md shadow-sm hover:bg-gray-50 disabled:opacity-50"
                        >
                            上一步
                        </button>
                        {currentStep < 3 ? (
                            <button
                                onClick={handleNext}
                                className="px-6 py-2 text-sm font-medium text-white bg-primary-600 border border-transparent rounded-md shadow-sm hover:bg-primary-700"
                            >
                                下一步
                            </button>
                        ) : (
                            <button
                                onClick={handleImport}
                                className="px-6 py-2 text-sm font-medium text-white bg-green-600 border border-transparent rounded-md shadow-sm hover:bg-green-700"
                            >
                                确认导入
                            </button>
                        )}
                    </div>
                </div>
            </div>
        </Modal>
    );
};

export default ImportSessionModal;
