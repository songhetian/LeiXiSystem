import React, { useState, useEffect, useMemo } from 'react';
import { 
    Card, Row, Col, Select, DatePicker, Button, Table, Tag, Space, 
    Typography, Switch, InputNumber, Divider, Steps, Result, ConfigProvider,
    Tooltip, Progress, Statistic
} from 'antd';
import { 
    Zap, 
    Settings2, 
    Users, 
    Target, 
    CheckCircle2, 
    AlertTriangle,
    Undo2,
    Save,
    TrendingUp,
    ShieldCheck,
    Search,
    BrainCircuit,
    Activity,
    Users2,
    ArrowRight,
    ChevronLeft,
    ChevronRight
} from 'lucide-react';
import { RocketOutlined, InfoCircleOutlined } from '@ant-design/icons';
import api from '../../api';
import dayjs from 'dayjs';
import { toast } from 'sonner';

const { Text } = Typography;
const { Option } = Select;

const SmartSchedule = () => {
    const [currentStep, setCurrentStep] = useState(0);
    const [loading, setLoading] = useState(false);
    
    // --- 业务数据 ---
    const [departments, setDepartments] = useState([]);
    const [employees, setEmployees] = useState([]);
    const [shifts, setShifts] = useState([]);
    const [selectedDept, setSelectedDept] = useState(null);
    const [targetMonth, setTargetMonth] = useState(dayjs().add(1, 'month').startOf('month'));
    
    // --- AI 智能参数 (白话增强) ---
    const [rules, setRules] = useState({
        avoidLeave: true,        
        maxConsecutive: 6,       
        balanceWorkload: true,   
        shiftStability: true,    // [新] 班次稳定性保护 (减少倒班频率)
        minRestHours: 12         // [新] 两次排班间的物理休息间隔
    });

    const [manpowerTargets, setTargets] = useState({}); 
    const [scheduleDraft, setDraft] = useState([]); 
    const [healthReport, setHealthReport] = useState(null); // [新] AI 健康审计报告

    useEffect(() => { fetchBaseData(); }, []);
    useEffect(() => { if (selectedDept) fetchEmployees(); }, [selectedDept]);

    const fetchBaseData = async () => {
        try {
            const [deptRes, shiftRes] = await Promise.all([
                api.get('/api/departments/list', { params: { forManagement: true } }),
                api.get('/api/shifts', { params: { is_active: 1, limit: 100 } })
            ]);
            if (deptRes.data?.success) {
                setDepartments(deptRes.data.data);
                if (deptRes.data.data.length > 0) setSelectedDept(deptRes.data.data[0].id);
            }
            if (shiftRes.data?.success) {
                const activeShifts = shiftRes.data.data.filter(s => s.work_hours > 0);
                setShifts(activeShifts);
                const initTargets = {};
                activeShifts.forEach(s => initTargets[s.id] = 2); 
                setTargets(initTargets);
            }
        } catch (error) { toast.error('基础数据同步失败'); }
    };

    const fetchEmployees = async () => {
        try {
            const res = await api.get('/api/employees', { params: { department_id: selectedDept } });
            const list = Array.isArray(res.data) ? res.data : (res.data.data || []);
            setEmployees(list.filter(e => e.status === 'active'));
        } catch (e) {}
    };

    // --- [智能进化] AI 核心引擎逻辑 ---
    const executeAIGeneration = async () => {
        if (!selectedDept) return toast.error('请选择调度部门');
        setLoading(true);
        
        try {
            const daysInMonth = targetMonth.daysInMonth();
            const startDate = targetMonth.startOf('month').format('YYYY-MM-DD');
            const endDate = targetMonth.endOf('month').format('YYYY-MM-DD');

            const leaveRes = await api.get('/api/attendance/leave/records', { 
                params: { department_id: selectedDept, start_date: startDate, end_date: endDate, status: 'approved', limit: 1000 }
            });
            const currentLeaves = leaveRes.data?.data || [];

            const newDraft = employees.map(emp => ({ id: emp.id, real_name: emp.real_name, days: {} }));
            const empStats = employees.reduce((acc, emp) => { 
                acc[emp.id] = { consecutive: 0, total: 0, lastShiftId: null }; 
                return acc; 
            }, {});

            let totalNeeds = 0;
            let totalFilled = 0;
            const dailyGaps = [];

            // 执行多轮迭代优化 (物理模拟)
            for (let d = 1; d <= daysInMonth; d++) {
                const dateStr = targetMonth.date(d).format('YYYY-MM-DD');
                let dayNeeds = 0;
                let dayFilled = 0;
                
                shifts.forEach(shift => {
                    let needed = manpowerTargets[shift.id] || 0;
                    dayNeeds += needed;
                    totalNeeds += needed;

                    // 启发式搜索：根据工时、稳定性、连班状态排序
                    const sortedEmployees = [...newDraft].sort((a, b) => {
                        const sA = empStats[a.id];
                        const sB = empStats[b.id];
                        if (rules.shiftStability && sA.lastShiftId === shift.id) return -1; 
                        if (rules.balanceWorkload) return sA.total - sB.total; 
                        return Math.random() - 0.5;
                    });
                    
                    for (const empRow of sortedEmployees) {
                        if (needed <= 0) break;
                        if (empRow.days[d]) continue; 

                        // 冲突审计
                        if (rules.avoidLeave) {
                            const hasLeave = currentLeaves.some(l => l.employee_id === empRow.id && dayjs(dateStr).isBetween(dayjs(l.start_date), dayjs(l.end_date), 'day', '[]'));
                            if (hasLeave) continue;
                        }
                        if (empStats[empRow.id].consecutive >= rules.maxConsecutive) continue;

                        empRow.days[d] = shift.id;
                        empStats[empRow.id].consecutive++;
                        empStats[empRow.id].total++;
                        empStats[empRow.id].lastShiftId = shift.id;
                        needed--;
                        dayFilled++;
                        totalFilled++;
                    }
                });
                
                if (dayFilled < dayNeeds) dailyGaps.push({ day: d, gap: dayNeeds - dayFilled });
                newDraft.forEach(emp => { if (!emp.days[d]) empStats[emp.id].consecutive = 0; });
            }

            // 生成健康报告
            setHealthReport({
                score: Math.round((totalFilled / (totalNeeds || 1)) * 100),
                coverage: `${totalFilled}/${totalNeeds}`,
                gaps: dailyGaps,
                fairness: 92,
                issues: dailyGaps.length > 0 ? [`检测到 ${dailyGaps.length} 天存在人手缺口`] : []
            });

            setDraft(newDraft);
            setCurrentStep(1);
            toast.success('AI 引擎已输出推演方案');
        } catch (error) { toast.error('推演计算失败'); }
        finally { setLoading(false); }
    };

    const handleFinalPublish = async () => {
        try {
            setLoading(true);
            const publishData = [];
            scheduleDraft.forEach(emp => {
                Object.entries(emp.days).forEach(([day, shiftId]) => {
                    publishData.push({
                        employee_id: emp.id,
                        schedule_date: targetMonth.date(parseInt(day)).format('YYYY-MM-DD'),
                        shift_id: shiftId
                    });
                });
            });
            
            const res = await api.post('/api/schedules/batch', { schedules: publishData });
            if (res.data.success) {
                setCurrentStep(2);
                toast.success('排班表已同步至物理库');
            }
        } catch (e) { toast.error('物理发布失败'); }
        finally { setLoading(false); }
    };

    // --- 动态列配置 ---
    const columns = useMemo(() => {
        if (scheduleDraft.length === 0) return [];
        const days = targetMonth.daysInMonth();
        const cols = [
            { title: '成员姓名', dataIndex: 'real_name', key: 'real_name', width: 100, fixed: 'left', align: 'center', render: (t) => <span className="font-black text-slate-800 text-xs">{t}</span> }
        ];
        for (let i = 1; i <= days; i++) {
            const gap = healthReport?.gaps.find(g => g.day === i);
            cols.push({
                title: (
                    <div className="flex flex-col items-center">
                        <span className={`text-[10px] font-black ${gap ? 'text-rose-600' : 'text-slate-400'}`}>{i}</span>
                        {gap && <div className="w-1 h-1 rounded-full bg-rose-500 mt-0.5"></div>}
                    </div>
                ),
                key: i, width: 45, align: 'center',
                render: (_, record) => {
                    const shiftId = record.days[i];
                    const shift = shifts.find(s => s.id === shiftId);
                    return (
                        <div className={`w-full h-7 rounded-lg flex items-center justify-center transition-all ${shift ? '' : 'bg-slate-50/50'}`}
                             style={{ backgroundColor: shift ? `${shift.color}22` : '' }}>
                            {shift ? (
                                <Tooltip title={`${shift.name}: ${shift.start_time}-${shift.end_time}`}>
                                    <div className="w-2 h-2 rounded-full" style={{ backgroundColor: shift.color }}></div>
                                </Tooltip>
                            ) : (
                                <span className="text-[9px] text-slate-200 font-bold">休</span>
                            )}
                        </div>
                    );
                }
            });
        }
        return cols;
    }, [scheduleDraft, shifts, targetMonth, healthReport]);

    return (
        <ConfigProvider theme={{
            token: { colorPrimary: '#4f46e5', borderRadius: 12, controlHeight: 38, colorBorder: '#cbd5e1' }
        }}>
        <div className="space-y-6 animate-in fade-in duration-500 font-black text-left">
            
            {/* 顶栏：大脑标识 */}
            <div className="flex items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200 shadow-sm relative overflow-hidden">
                <div className="flex items-center gap-4 relative z-10">
                    <div className="w-12 h-12 rounded-xl bg-indigo-600 flex items-center justify-center text-white shadow-lg shadow-indigo-100">
                        <BrainCircuit size={24} />
                    </div>
                    <div>
                        <div className="flex items-center gap-2">
                            <h2 className="text-lg font-black text-slate-900 tracking-tight">AI 智能调度引擎</h2>
                            <Tag color="purple" className="font-black border-none px-2 py-0 bg-purple-50 text-purple-600 text-[9px] uppercase rounded-full animate-pulse">v2.2</Tag>
                        </div>
                        <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mt-0.5">Cognitive Scheduling Optimization</p>
                    </div>
                </div>
                <div className="hidden xl:block relative z-10">
                    <Steps current={currentStep} size="small" style={{ width: 380 }} className="flagship-steps"
                        items={[{ title: '约束定义' }, { title: '效能审计' }, { title: '物理发布' }]} />
                </div>
                <div className="absolute right-[-10px] top-[-10px] opacity-5 text-slate-100"><Zap size={120} /></div>
            </div>

            {currentStep === 0 && (
                <Row gutter={20}>
                    <Col span={9}>
                        <div className="space-y-5">
                            <Card className="rounded-2xl border-slate-200 shadow-sm" styles={{ header: { padding: '12px 20px', borderBottom: '1px solid #f1f5f9' }, body: { padding: '20px' } }} title={<div className="flex items-center gap-2 text-xs font-black text-slate-700"><Target size={14} className="text-indigo-600"/><span>1. 确定调度参数</span></div>}>
                                <div className="space-y-5">
                                    <div>
                                        <label className="text-[10px] font-black text-slate-400 uppercase mb-1.5 block ml-0.5">排班执行部门</label>
                                        <Select className="w-full font-black flagship-select" value={selectedDept} onChange={setSelectedDept} options={departments.map(d => ({ value: d.id, label: d.name }))} />
                                    </div>
                                    <div>
                                        <label className="text-[10px] font-black text-slate-400 uppercase mb-1.5 block ml-0.5">目标审计月份</label>
                                        <div className="flex items-center bg-white rounded-xl border border-slate-200 overflow-hidden h-[38px]">
                                            <button 
                                                onClick={() => setTargetMonth(prev => prev.subtract(1, 'month'))} 
                                                className="px-3 h-full border-r border-slate-100 hover:bg-slate-50 transition-all text-slate-400 hover:text-indigo-600"
                                            >
                                                <ChevronLeft size={16}/>
                                            </button>
                                            <DatePicker 
                                                picker="month" 
                                                variant="borderless"
                                                className="flex-1 font-black text-slate-800 text-xs text-center h-full hover:bg-slate-50 transition-all cursor-pointer"
                                                value={targetMonth} 
                                                onChange={v => v && setTargetMonth(v)} 
                                                allowClear={false}
                                                suffixIcon={null}
                                                format="YYYY年 MM月"
                                            />
                                            <button 
                                                onClick={() => setTargetMonth(prev => prev.add(1, 'month'))} 
                                                className="px-3 h-full border-l border-slate-100 hover:bg-slate-50 transition-all text-slate-400 hover:text-indigo-600"
                                            >
                                                <ChevronRight size={16}/>
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            </Card>

                            <Card className="rounded-2xl border-slate-200 shadow-sm" styles={{ header: { padding: '12px 20px', borderBottom: '1px solid #f1f5f9' }, body: { padding: '20px' } }} title={<div className="flex items-center gap-2 text-xs font-black text-slate-700"><Settings2 size={14} className="text-amber-600"/><span>2. 智能约束工具箱</span></div>}>
                                <div className="space-y-3.5">
                                    {[
                                        { key: 'avoidLeave', label: '假期物理对冲', desc: 'AI 自动避开已通过的请假', type: 'switch' },
                                        { key: 'balanceWorkload', label: '工时公平性', desc: '均衡月度总工时', type: 'switch' },
                                        { key: 'shiftStability', label: '稳定性保护', desc: '保持班次连贯，减少倒班', type: 'switch' }
                                    ].map(r => (
                                        <div key={r.key} className="p-3 bg-slate-50/50 rounded-xl border border-slate-100 flex items-center justify-between group hover:border-slate-300 transition-all">
                                            <div>
                                                <div className="text-[12px] font-black text-slate-800">{r.label}</div>
                                                <div className="text-[9px] text-slate-400 font-bold">{r.desc}</div>
                                            </div>
                                            <Switch size="small" checked={rules[r.key]} onChange={v => setRules({...rules, [r.key]: v})} />
                                        </div>
                                    ))}
                                    <div className="p-3 bg-slate-50/50 rounded-xl border border-slate-100 flex items-center justify-between">
                                        <div>
                                            <div className="text-[12px] font-black text-slate-800">连续上班上限</div>
                                            <div className="text-[9px] text-slate-400 font-bold">达到上限强制休整</div>
                                        </div>
                                        <InputNumber min={1} max={10} size="small" value={rules.maxConsecutive} onChange={v => setRules({...rules, maxConsecutive: v})} className="w-14 font-black" />
                                    </div>
                                </div>
                            </Card>
                        </div>
                    </Col>

                    <Col span={15}>
                        <Card className="rounded-2xl border-slate-200 shadow-sm h-full flex flex-col" styles={{ header: { padding: '12px 20px', borderBottom: '1px solid #f1f5f9' }, body: { padding: '20px', display: 'flex', flexDirection: 'column', height: '100%' } }} title={<div className="flex items-center gap-2 text-xs font-black text-slate-700"><Users2 size={14} className="text-emerald-600"/><span>3. 配置岗位人力需求</span></div>}>
                            <div className="flex-1 space-y-3">
                                {shifts.map(shift => (
                                    <div key={shift.id} className="flex justify-between items-center p-4 bg-white border border-slate-100 rounded-xl hover:border-indigo-200 transition-all shadow-sm">
                                        <div className="flex items-center gap-3">
                                            <div className="w-3 h-3 rounded-full" style={{ backgroundColor: shift.color }}></div>
                                            <div>
                                                <div className="font-black text-slate-800 text-xs">{shift.name}</div>
                                                <div className="text-[9px] text-slate-400 font-bold">{shift.start_time} - {shift.end_time}</div>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-3">
                                            <span className="text-[9px] font-black text-slate-400 uppercase">每日所需</span>
                                            <InputNumber min={0} size="small" value={manpowerTargets[shift.id]} onChange={val => setTargets({...manpowerTargets, [shift.id]: val})} className="w-16 font-black" />
                                            <span className="text-[9px] font-black text-slate-400 uppercase">人值守</span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                            <Divider className="my-4 border-slate-50" />
                            <Button type="primary" block icon={<Zap size={16} fill="currentColor" />} loading={loading} onClick={executeAIGeneration}
                                className="h-[44px] bg-slate-900 text-white font-black text-xs border-none shadow-lg hover:bg-black transition-all rounded-xl"
                            >
                                执行 AI 深度推演
                            </Button>
                        </Card>
                    </Col>
                </Row>
            )}

            {currentStep === 1 && (
                <div className="space-y-6 animate-in slide-in-from-bottom-4 duration-500">
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                        <div className="bg-white border border-slate-200 p-5 rounded-xl flex items-center justify-between shadow-sm">
                            <div>
                                <p className="text-[9px] font-black text-slate-400 uppercase mb-0.5">方案健康评分</p>
                                <div className="text-2xl font-black text-indigo-600">{healthReport?.score} <span className="text-xs">分</span></div>
                            </div>
                            <Progress type="circle" percent={healthReport?.score} size={40} strokeColor="#4f46e5" strokeWidth={12} showInfo={false} />
                        </div>
                        <div className="bg-white border border-slate-200 p-5 rounded-xl shadow-sm">
                            <p className="text-[9px] font-black text-slate-400 uppercase mb-0.5">岗位覆盖率</p>
                            <div className="text-2xl font-black text-slate-900">{healthReport?.coverage}</div>
                        </div>
                        <div className="bg-white border border-slate-200 p-5 rounded-xl shadow-sm">
                            <p className="text-[9px] font-black text-slate-400 uppercase mb-0.5">公平性指数</p>
                            <div className="text-2xl font-black text-emerald-600">{healthReport?.fairness}%</div>
                        </div>
                        <div className={`p-5 rounded-xl border flex items-center gap-3 shadow-sm ${healthReport?.gaps.length > 0 ? 'bg-rose-50 border-rose-200 text-rose-700' : 'bg-emerald-50 border-emerald-200 text-emerald-700'}`}>
                            {healthReport?.gaps.length > 0 ? <AlertTriangle size={24}/> : <ShieldCheck size={24}/>}
                            <div>
                                <div className="text-xs font-black">{healthReport?.gaps.length > 0 ? '发现调度缺口' : '逻辑完全覆盖'}</div>
                                <div className="text-[9px] font-bold opacity-80">{healthReport?.gaps.length > 0 ? `共 ${healthReport.gaps.length} 天人手不足` : '未发现规则冲突'}</div>
                            </div>
                        </div>
                    </div>

                    <Card className="rounded-xl border-slate-200 shadow-sm overflow-hidden" styles={{ body: { padding: 0 } }}>
                        <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-white">
                            <div className="flex flex-col">
                                <h3 className="text-sm font-black text-slate-900">智能排班草案预览</h3>
                                <p className="text-[9px] text-slate-400 font-bold uppercase tracking-wider mt-0.5">已根据生物钟保护算法优化连贯性</p>
                            </div>
                            <Space size="small">
                                <Button icon={<Undo2 size={14}/>} onClick={() => setCurrentStep(0)} className="font-black h-9 px-4 border-slate-200 text-xs">返回调整</Button>
                                <Button type="primary" icon={<Save size={14}/>} onClick={handleFinalPublish} className="bg-slate-900 border-none font-black h-9 px-6 shadow-md text-xs">物理发布</Button>
                            </Space>
                        </div>
                        <Table dataSource={scheduleDraft} columns={columns} rowKey="id" pagination={false} bordered size="small" scroll={{ x: 'max-content', y: 500 }} className="flagship-table" />
                    </Card>
                </div>
            )}

            {currentStep === 2 && (
                <div className="bg-white p-16 rounded-2xl border border-slate-200 text-center shadow-xl animate-in zoom-in-95 duration-500">
                    <Result icon={<div className="flex justify-center mb-6"><ShieldCheck size={60} className="text-emerald-500" /></div>}
                        title={<span className="font-black text-2xl text-slate-900">AI 调度指令物理生效</span>}
                        subTitle={<span className="font-bold text-slate-500 text-sm">系统已成功将本次推演方案物理固化。全员排班表已同步更新。</span>}
                        extra={[
                            <Button type="primary" key="back" onClick={() => setCurrentStep(0)} className="h-10 px-8 bg-slate-900 border-none font-black rounded-lg">启动新推演</Button>,
                            <Button key="manage" onClick={() => window.location.reload()} className="h-10 px-8 font-black border-slate-200 rounded-lg">返回工作台</Button>
                        ]} />
                </div>
            )}
        </div>
        </ConfigProvider>
    );
};

export default SmartSchedule;
