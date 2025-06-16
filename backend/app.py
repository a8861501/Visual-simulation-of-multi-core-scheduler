from flask import Flask, request, jsonify
from flask_cors import CORS
from flask_socketio import SocketIO, emit
import time
import threading
import random

app = Flask(__name__)
CORS(app)
socketio = SocketIO(app, cors_allowed_origins="*")

# Core templates
P_CORE_TEMPLATE = {
    "type": "big",
    "max_freq": 3.5,  # GHz
    "min_freq": 1.2,
    "dvfs_levels": [1.2, 2.5, 3.5],
    "base_power": 1.5,  # W @ base freq
    "base_perf_score": 90,
    "thermal_threshold": 85.0,  # ℃
    "cooling_rate": 0.4,
    "heating_rate_factor": 0.8,
    "instruction_preference": {
        "scalar": 1.0,
        "vector": 1.2,
        "ai": 1.3,
        "io": 0.8
    }
}

E_CORE_TEMPLATE = {
    "type": "little",
    "max_freq": 2.0,  # GHz
    "min_freq": 0.8,
    "dvfs_levels": [0.8, 1.2, 2.0],
    "base_power": 0.6,  # W @ base freq
    "base_perf_score": 60,
    "thermal_threshold": 75.0,  # ℃
    "cooling_rate": 0.6,
    "heating_rate_factor": 0.5,
    "instruction_preference": {
        "scalar": 1.0,
        "vector": 0.7,
        "ai": 0.4,
        "io": 1.2
    }
}

class Core:
    def __init__(self, core_id, core_type="P"):
        self.core_id = core_id
        
        # 選擇核心模板
        template = P_CORE_TEMPLATE if core_type == "P" else E_CORE_TEMPLATE
        
        # 基本屬性
        self.core_type = core_type
        self.type = template["type"]
        self.max_freq = template["max_freq"]
        self.min_freq = template["min_freq"]
        self.dvfs_levels = template["dvfs_levels"].copy()
        self.base_power = template["base_power"]
        self.base_perf_score = template["base_perf_score"]
        self.thermal_threshold = template["thermal_threshold"]
        self.cooling_rate = template["cooling_rate"]
        self.heating_rate_factor = template["heating_rate_factor"]
        self.instruction_preference = template["instruction_preference"].copy()
        
        # 動態參數
        self.load = 0.0  # 0~1
        self.temp = 25.0  # 攝氏度，初始室溫
        self.power = self.base_power  # 當前功耗 (W)
        self.dvfs_freq = self.max_freq  # 當前頻率
        self.performance_score = self.base_perf_score  # 0~100
        self.thermal_throttling = False
        self.active = False
        self.task_history = []  # 最近執行的任務
        self.power_budget = self.base_power * 2  # 功耗上限
        
        # 兼容性屬性 (向後兼容)
        self.frequency = self.dvfs_freq
        self.power_coefficient = self.base_power
        self.current_task = None
        self.total_execution_time = 0
        self.total_power_consumption = 0
        self.is_running = False

class Task:
    def __init__(self, task_id, name, task_type, arrival_time=0, deadline=None, 
                 priority_class="NORMAL", thread_priority="NORMAL", 
                 instruction_mix=None, cpu_burst=50, io_wait=0.2, 
                 realtime=False, affinity_hint=None, dependencies=None):
        self.task_id = task_id
        self.name = name
        self.task_type = task_type
        self.arrival_time = arrival_time
        self.deadline = deadline
        self.priority_class = priority_class
        self.thread_priority = thread_priority
        self.instruction_mix = instruction_mix or {"scalar": 0.5, "vector": 0.2, "ai": 0.1, "io": 0.2}
        self.cpu_burst = cpu_burst
        self.io_wait = io_wait
        self.realtime = realtime
        self.affinity_hint = affinity_hint or []
        self.dependencies = dependencies or []
        self.completed = False
        
        # 計算執行時間基於 cpu_burst
        self.execution_time = cpu_burst / 10  # 簡化計算，可根據需要調整

# Task type configurations
def get_task_config(task_type, name=None, arrival_time=0):
    if name is None:
        name = f"{task_type}_{random.randint(1000, 9999)}"

    task_configs = {
        "browser": {
            "name": name,
            "arrival_time": arrival_time,
            "deadline": arrival_time + 30,
            "priority_class": "NORMAL",
            "thread_priority": "ABOVE_NORMAL",
            "instruction_mix": {"scalar": 0.5, "vector": 0.1, "ai": 0.0, "io": 0.4},
            "cpu_burst": 80,
            "io_wait": 0.4,
            "realtime": False,
            "affinity_hint": []
        },
        "game": {
            "name": name,
            "arrival_time": arrival_time,
            "deadline": arrival_time + 10,
            "priority_class": "REALTIME",
            "thread_priority": "TIME_CRITICAL",
            "instruction_mix": {"scalar": 0.1, "vector": 0.5, "ai": 0.3, "io": 0.1},
            "cpu_burst": 150,
            "io_wait": 0.1,
            "realtime": True,
            "affinity_hint": ["big"]
        },
        "music": {
            "name": name,
            "arrival_time": arrival_time,
            "deadline": arrival_time + 50,
            "priority_class": "IDLE",
            "thread_priority": "LOWEST",
            "instruction_mix": {"scalar": 0.3, "vector": 0.0, "ai": 0.0, "io": 0.7},
            "cpu_burst": 40,
            "io_wait": 0.6,
            "realtime": True,
            "affinity_hint": ["little"]
        },
        "video_encode": {
            "name": name,
            "arrival_time": arrival_time,
            "deadline": arrival_time + 60,
            "priority_class": "HIGH",
            "thread_priority": "HIGHEST",
            "instruction_mix": {"scalar": 0.2, "vector": 0.6, "ai": 0.1, "io": 0.1},
            "cpu_burst": 200,
            "io_wait": 0.1,
            "realtime": False,
            "affinity_hint": ["big"]
        },        "typing": {
            "name": name,
            "arrival_time": arrival_time,
            "deadline": arrival_time + 40,
            "priority_class": "NORMAL",
            "thread_priority": "NORMAL",
            "instruction_mix": {"scalar": 0.4, "vector": 0.0, "ai": 0.0, "io": 0.6},
            "cpu_burst": 30,
            "io_wait": 0.5,
            "realtime": False,
            "affinity_hint": ["little"]
        },
        "spotify": {
            "name": name,
            "arrival_time": arrival_time,
            "deadline": arrival_time + 50,
            "priority_class": "IDLE",
            "thread_priority": "LOWEST",
            "instruction_mix": {"scalar": 0.2, "vector": 0.0, "ai": 0.0, "io": 0.8},
            "cpu_burst": 40,
            "io_wait": 0.6,
            "realtime": True,
            "affinity_hint": ["little"]
        },
        "video_call": {
            "name": name,
            "arrival_time": arrival_time,
            "deadline": arrival_time + 8,
            "priority_class": "REALTIME",
            "thread_priority": "HIGHEST",
            "instruction_mix": {"scalar": 0.3, "vector": 0.2, "ai": 0.1, "io": 0.4},
            "cpu_burst": 120,
            "io_wait": 0.2,
            "realtime": True,
            "affinity_hint": ["big"]
        },
        "file_download": {
            "name": name,
            "arrival_time": arrival_time,
            "deadline": arrival_time + 100,
            "priority_class": "NORMAL",
            "thread_priority": "BELOW_NORMAL",
            "instruction_mix": {"scalar": 0.1, "vector": 0.0, "ai": 0.0, "io": 0.9},
            "cpu_burst": 25,
            "io_wait": 0.8,
            "realtime": False,
            "affinity_hint": ["little"]
        },
        "ai_processing": {
            "name": name,
            "arrival_time": arrival_time,
            "deadline": arrival_time + 30,
            "priority_class": "HIGH",
            "thread_priority": "ABOVE_NORMAL",
            "instruction_mix": {"scalar": 0.1, "vector": 0.2, "ai": 0.6, "io": 0.1},
            "cpu_burst": 300,
            "io_wait": 0.1,
            "realtime": False,
            "affinity_hint": ["big"]
        },
        "system_backup": {
            "name": name,
            "arrival_time": arrival_time,
            "deadline": arrival_time + 300,
            "priority_class": "IDLE",
            "thread_priority": "LOWEST",
            "instruction_mix": {"scalar": 0.2, "vector": 0.0, "ai": 0.0, "io": 0.8},
            "cpu_burst": 50,
            "io_wait": 0.7,
            "realtime": False,
            "affinity_hint": ["little"]
        },
        "photo_editing": {
            "name": name,
            "arrival_time": arrival_time,
            "deadline": arrival_time + 45,
            "priority_class": "NORMAL",
            "thread_priority": "NORMAL",
            "instruction_mix": {"scalar": 0.3, "vector": 0.4, "ai": 0.2, "io": 0.1},
            "cpu_burst": 180,
            "io_wait": 0.3,
            "realtime": False,
            "affinity_hint": ["big"]
        }
    }
    
    if task_type not in task_configs:
        raise ValueError(f"Unsupported task type: {task_type}")
    
    return task_configs[task_type]

class Scheduler:
    def __init__(self, cores, tasks):
        self.cores = cores
        self.tasks = tasks
        self.completed_tasks = []
        self.current_time = 0
        
    def basic_idle_first_scheduler(self, current_time):
        """
        將尚未執行的任務分配給目前 idle 的核心
        """
        # 選出尚未分配的任務
        ready_tasks = [t for t in self.tasks if not hasattr(t, 'assigned') or not t.assigned]
        ready_tasks = [t for t in ready_tasks if t.arrival_time <= current_time]
        
        # 選出目前 idle 的核心
        idle_cores = [c for c in self.cores if not c.active]

        # 根據 performance_score 選最佳核心
        assignments = []
        for task in ready_tasks:
            if not idle_cores:
                break  # 沒核心可用，跳出

            # 計算每個核心對此任務的效能分數
            best_core = None
            best_score = 0
            
            for core in idle_cores:
                # 計算核心對任務的適配度
                score = self.calculate_core_task_affinity(core, task)
                if score > best_score:
                    best_score = score
                    best_core = core
            
            if best_core:
                idle_cores.remove(best_core)
                
                # 分配任務
                best_core.active = True
                best_core.current_task = task
                best_core.task_time_left = task.cpu_burst
                best_core.task_start_time = current_time
                task.assigned = True
                task.assigned_core = best_core.core_id
                
                assignments.append({
                    'core_id': best_core.core_id,
                    'task': task.name,
                    'task_id': task.task_id,
                    'start_time': current_time,
                    'estimated_duration': task.cpu_burst / 10  # 簡化計算
                })
        
        return assignments
    
    def calculate_core_task_affinity(self, core, task):
        """計算核心對任務的適配度分數"""
        base_score = core.performance_score
        
        # 根據指令偏好調整分數
        affinity_bonus = 0
        for instr_type, task_ratio in task.instruction_mix.items():
            if instr_type in core.instruction_preference:
                affinity_bonus += task_ratio * core.instruction_preference[instr_type] * 10
        
        # 根據親和性提示調整
        if hasattr(task, 'affinity_hint') and task.affinity_hint:
            if core.type in task.affinity_hint:
                affinity_bonus += 20
        
        # 考慮溫度限制
        if core.thermal_throttling:
            base_score *= 0.7
            
        return base_score + affinity_bonus
    
    def update_cores(self, time_delta):
        """更新核心狀態"""
        completed_tasks = []
        
        for core in self.cores:
            if core.active and hasattr(core, 'task_time_left'):
                core.task_time_left -= time_delta
                
                # 更新核心溫度和功耗
                self.update_core_thermals(core, time_delta)
                
                if core.task_time_left <= 0:
                    # 任務完成
                    completed_task = core.current_task
                    completed_task.completed = True
                    completed_tasks.append(completed_task)
                    
                    # 重置核心狀態
                    core.active = False
                    core.current_task = None
                    core.load = 0.0
                    delattr(core, 'task_time_left')
                    delattr(core, 'task_start_time')
                    
                    # 添加到歷史
                    core.task_history.append(completed_task.name)
                    if len(core.task_history) > 5:  # 保持最近5個任務
                        core.task_history.pop(0)
        
        return completed_tasks
    
    def update_core_thermals(self, core, time_delta):
        """更新核心溫度和功耗"""
        if core.active:
            # 計算工作負載
            task = core.current_task
            core.load = min(1.0, task.cpu_burst / 100.0)  # 簡化負載計算
            
            # 計算功耗
            freq_factor = core.dvfs_freq / core.max_freq
            load_factor = core.load
            core.power = core.base_power * (1 + freq_factor * load_factor)
            
            # 更新溫度
            heating = core.power * core.heating_rate_factor * time_delta
            core.temp += heating
            
            # 檢查溫度限制
            if core.temp > core.thermal_threshold:
                core.thermal_throttling = True
                core.dvfs_freq = max(core.min_freq, core.dvfs_freq * 0.9)
            else:
                core.thermal_throttling = False
                if core.dvfs_freq < core.max_freq:
                    core.dvfs_freq = min(core.max_freq, core.dvfs_freq * 1.05)
        else:
            # 核心閒置時冷卻
            core.load = 0.0
            core.power = core.base_power * 0.3  # 閒置功耗
            cooling = core.cooling_rate * time_delta
            core.temp = max(25.0, core.temp - cooling)  # 室溫下限
    
    # 保留舊的調度方法以向後兼容
    def edf_schedule(self):
        """Earliest Deadline First scheduling"""
        # Sort tasks by deadline
        sorted_tasks = sorted([t for t in self.tasks if not t.completed], 
                            key=lambda x: x.deadline or float('inf'))
        
        schedule = []
        time_slot = 0
        
        while len(self.completed_tasks) < len(self.tasks):
            available_cores = [c for c in self.cores if not c.is_running]
            ready_tasks = [t for t in sorted_tasks if not t.completed and 
                          all(dep in [ct.task_id for ct in self.completed_tasks] for dep in t.dependencies)]
            
            if not available_cores or not ready_tasks:
                time_slot += 1
                continue
                
            # Assign tasks to cores
            for i, task in enumerate(ready_tasks[:len(available_cores)]):
                core = available_cores[i]
                schedule.append({
                    'time': time_slot,
                    'core_id': core.core_id,
                    'task': task.name,
                    'duration': task.execution_time
                })
                task.completed = True
                self.completed_tasks.append(task)
                
            time_slot += max([t.execution_time for t in ready_tasks[:len(available_cores)]])
            
        return schedule
    
    def heft_schedule(self):
        """Heterogeneous Earliest Finish Time scheduling"""
        schedule = []
        core_available_time = [0] * len(self.cores)
        
        # 正確計算 upward rank
        upward_ranks = {}
        # 先處理沒有依賴的任務
        for task in self.tasks:
            if not task.dependencies:
                upward_ranks[task.task_id] = task.execution_time
        
        # 從依賴較少的任務開始計算
        for task in sorted(self.tasks, key=lambda t: len(t.dependencies)):
            if task.task_id not in upward_ranks:
                # 取決於所有前置任務的最大 rank
                max_pred_rank = 0
                for dep in task.dependencies:
                    if dep in upward_ranks:
                        max_pred_rank = max(max_pred_rank, upward_ranks[dep])
                upward_ranks[task.task_id] = task.execution_time + max_pred_rank
        
        # 按 upward rank 排序
        sorted_tasks = sorted(self.tasks, key=lambda x: upward_ranks[x.task_id], reverse=True)
        
        # 追蹤已完成的任務
        completed_tasks = []
        
        for task in sorted_tasks:
            # 檢查依賴是否滿足
            if not all(dep in [t.task_id for t in completed_tasks] for dep in task.dependencies):
                continue
                
            # 找最早完成時間的核心
            best_core = None
            earliest_finish = float('inf')
            
            for i, core in enumerate(self.cores):
                start_time = core_available_time[i]
                finish_time = start_time + task.execution_time / core.frequency
                
                if finish_time < earliest_finish:
                    earliest_finish = finish_time
                    best_core = core
                    best_core_idx = i
            
            if best_core:
                start_time = core_available_time[best_core_idx]
                schedule.append({
                    'time': start_time,
                    'core_id': best_core.core_id,
                    'task': task.name,
                    'duration': task.execution_time / best_core.frequency
                })
                core_available_time[best_core_idx] = earliest_finish
                completed_tasks.append(task)
        
        return schedule
    
    def eas_schedule(self):
        """Energy Aware Scheduling"""
        schedule = []
        time_slot = 0
        
        for task in self.tasks:
            # Choose core with best energy efficiency
            best_core = min(self.cores, key=lambda c: c.power_coefficient * task.execution_time)
            
            duration = task.execution_time / best_core.frequency
            schedule.append({
                'time': time_slot,
                'core_id': best_core.core_id,
                'task': task.name,
                'duration': duration
            })
            
            time_slot += duration
            
        return schedule

@app.route('/api/cores', methods=['POST'])
def create_cores():
    data = request.json
    cores = []
    for i, core_config in enumerate(data['cores']):
        core = Core(
            core_id=i,
            core_type=core_config.get('core_type', 'P')
        )
        cores.append(core)
    
    return jsonify({'status': 'success', 'cores_created': len(cores)})

@app.route('/api/execute', methods=['POST'])
def execute_scheduling():
    data = request.json
    
    # Create cores
    cores = []
    for i, core_config in enumerate(data['cores']):
        core = Core(
            core_id=i,
            core_type=core_config.get('core_type', 'P')
        )
        cores.append(core)
      # Create tasks
    tasks = []
    for i, task_data in enumerate(data['tasks']):
        # Get task type configuration
        task_type = task_data.get('task_type', 'browser')
        arrival_time = task_data.get('arrival_time', 0)
        custom_name = task_data.get('name')
        
        # Get configuration for this task type
        task_config = get_task_config(task_type, custom_name, arrival_time)
        
        # Create task with all parameters
        task = Task(
            task_id=i,
            name=task_config['name'],
            task_type=task_type,
            arrival_time=task_config['arrival_time'],
            deadline=task_config['deadline'],
            priority_class=task_config['priority_class'],
            thread_priority=task_config['thread_priority'],
            instruction_mix=task_config['instruction_mix'],
            cpu_burst=task_config['cpu_burst'],
            io_wait=task_config['io_wait'],
            realtime=task_config['realtime'],
            affinity_hint=task_config['affinity_hint'],
            dependencies=task_data.get('dependencies', [])
        )
        tasks.append(task)
    
    # Create scheduler and execute
    scheduler = Scheduler(cores, tasks)
    
    if data['strategy'] == 'EDF':
        schedule = scheduler.edf_schedule()
    elif data['strategy'] == 'HEFT':
        schedule = scheduler.heft_schedule()
    elif data['strategy'] == 'EAS':
        schedule = scheduler.eas_schedule()
    else:
        return jsonify({'error': 'Invalid strategy'})
    
    # Start simulation in background thread
    thread = threading.Thread(target=simulate_execution, args=(schedule, cores))
    thread.start()
    
    return jsonify({'status': 'started', 'schedule': schedule})

@app.route('/api/execute_realtime', methods=['POST'])
def execute_realtime_scheduling():
    """實時調度API"""
    data = request.json
    
    # Get max simulation time from request, default to 60 seconds
    max_simulation_time = data.get('max_simulation_time', 60)
    
    # Create cores
    cores = []
    for i, core_config in enumerate(data['cores']):
        core = Core(
            core_id=i,
            core_type=core_config.get('core_type', 'P')
        )
        cores.append(core)
    
    # Create tasks
    tasks = []
    for i, task_data in enumerate(data['tasks']):
        task_type = task_data.get('task_type', 'browser')
        arrival_time = task_data.get('arrival_time', 0)
        custom_name = task_data.get('name')
        
        task_config = get_task_config(task_type, custom_name, arrival_time)
        
        task = Task(
            task_id=i,
            name=task_config['name'],
            task_type=task_type,
            arrival_time=task_config['arrival_time'],
            deadline=task_config['deadline'],
            priority_class=task_config['priority_class'],
            thread_priority=task_config['thread_priority'],
            instruction_mix=task_config['instruction_mix'],
            cpu_burst=task_config['cpu_burst'],
            io_wait=task_config['io_wait'],
            realtime=task_config['realtime'],
            affinity_hint=task_config['affinity_hint'],
            dependencies=task_data.get('dependencies', [])
        )
        task.assigned = False
        tasks.append(task)
      # Create scheduler
    scheduler = Scheduler(cores, tasks)
    
    # Start real-time simulation
    thread = threading.Thread(target=simulate_realtime_execution, args=(scheduler, max_simulation_time))
    thread.start()
    
    return jsonify({'status': 'started', 'message': 'Real-time scheduling started', 'max_time': max_simulation_time})

def simulate_execution(schedule, cores):
    """Simulate the execution and emit real-time updates"""
    for step in schedule:
        # Emit core state update
        socketio.emit('core_update', {
            'core_id': step['core_id'],
            'status': 'running',
            'task': step['task']
        })
        
        # Simulate execution time
        time.sleep(min(step['duration'], 2))  # Cap at 2 seconds for demo
        
        # Update core statistics
        core = cores[step['core_id']]
        core.total_execution_time += step['duration']
        core.total_power_consumption += core.power_coefficient * step['duration']
        
        # Emit completion
        socketio.emit('core_update', {
            'core_id': step['core_id'],
            'status': 'idle',
            'task': None
        })
    
    # Send final statistics
    stats = []
    for core in cores:
        stats.append({
            'core_id': core.core_id,
            'total_execution_time': core.total_execution_time,
            'total_power_consumption': core.total_power_consumption
        })
    
    socketio.emit('simulation_complete', {'statistics': stats})

def simulate_realtime_execution(scheduler, max_simulation_time=60):
    """實時模擬執行"""
    current_time = 0
    time_step = 0.1  # 100ms time steps
    simulation_timeout = False
    
    # 統計資料
    stats = {
        'tasks_completed': 0,
        'tasks_assigned': 0,
        'total_tasks': len(scheduler.tasks),
        'core_utilization': {core.core_id: {'active_time': 0, 'idle_time': 0} for core in scheduler.cores},
        'avg_temperature': 0,
        'total_power_consumed': 0,
        'thermal_throttling_events': 0
    }
    
    while current_time < max_simulation_time:
        # 分配新任務
        assignments = scheduler.basic_idle_first_scheduler(current_time)
        
        # 發送任務分配更新
        if assignments:
            stats['tasks_assigned'] += len(assignments)
            for assignment in assignments:
                socketio.emit('task_assigned', assignment)
        
        # 更新核心狀態
        completed_tasks = scheduler.update_cores(time_step)
        
        # 更新統計資料
        stats['tasks_completed'] += len(completed_tasks)
        
        # 計算核心利用率和統計
        total_temp = 0
        total_power = 0
        for core in scheduler.cores:
            if core.active:
                stats['core_utilization'][core.core_id]['active_time'] += time_step
            else:
                stats['core_utilization'][core.core_id]['idle_time'] += time_step
                
            total_temp += core.temp
            total_power += core.power
            
            if core.thermal_throttling:
                stats['thermal_throttling_events'] += 1
        
        stats['avg_temperature'] = total_temp / len(scheduler.cores)
        stats['total_power_consumed'] += total_power * time_step
        
        # 發送核心狀態更新
        core_states = []
        for core in scheduler.cores:
            state = {
                'core_id': core.core_id,
                'active': core.active,
                'load': round(core.load * 100, 1),
                'temp': round(core.temp, 1),
                'freq': round(core.dvfs_freq, 2),
                'power': round(core.power, 2),
                'thermal_throttling': core.thermal_throttling,
                'current_task': core.current_task.name if core.current_task else None,
                'task_time_left': getattr(core, 'task_time_left', 0)
            }
            core_states.append(state)
        
        socketio.emit('core_states_update', {
            'cores': core_states, 
            'time': current_time,
            'remaining_time': max_simulation_time - current_time
        })
        
        # 發送任務完成更新
        for task in completed_tasks:
            socketio.emit('task_completed', {
                'task_id': task.task_id,
                'task_name': task.name,
                'completion_time': current_time
            })
        
        # 檢查是否所有任務都完成
        if all(hasattr(task, 'completed') and task.completed for task in scheduler.tasks):
            break
            
        current_time += time_step
        time.sleep(time_step)  # 實際等待時間
    
    # 檢查是否因為時間限制而結束
    if current_time >= max_simulation_time:
        simulation_timeout = True
        # 強制停止所有核心
        for core in scheduler.cores:
            if core.active:
                core.active = False
                core.current_task = None
                if hasattr(core, 'task_time_left'):
                    delattr(core, 'task_time_left')
                if hasattr(core, 'task_start_time'):
                    delattr(core, 'task_start_time')
    
    # 計算最終統計
    final_stats = calculate_final_statistics(scheduler, stats, current_time, simulation_timeout)
    
    # 發送模擬完成
    socketio.emit('simulation_complete', {
        'total_time': current_time,
        'timeout': simulation_timeout,
        'statistics': final_stats,
        'message': 'Simulation completed due to timeout' if simulation_timeout else 'All tasks completed'
    })

def calculate_final_statistics(scheduler, stats, total_time, timeout):
    """計算最終統計資料"""
    final_stats = []
    
    for core in scheduler.cores:
        utilization = stats['core_utilization'][core.core_id]
        active_time = utilization['active_time']
        idle_time = utilization['idle_time']
        total_core_time = active_time + idle_time
        
        utilization_percentage = (active_time / total_core_time * 100) if total_core_time > 0 else 0
        
        core_stats = {
            'core_id': core.core_id,
            'core_type': core.core_type,
            'utilization_percentage': round(utilization_percentage, 2),
            'active_time': round(active_time, 2),
            'idle_time': round(idle_time, 2),
            'final_temperature': round(core.temp, 1),
            'avg_frequency': round(core.dvfs_freq, 2),
            'total_power_consumption': round(core.total_power_consumption, 2),
            'tasks_executed': len(core.task_history)
        }
        final_stats.append(core_stats)
    
    # 添加全局統計
    global_stats = {
        'simulation_time': round(total_time, 2),
        'timeout_occurred': timeout,
        'tasks_completed': stats['tasks_completed'],
        'tasks_assigned': stats['tasks_assigned'],
        'total_tasks': stats['total_tasks'],
        'completion_rate': round((stats['tasks_completed'] / stats['total_tasks']) * 100, 2),
        'avg_system_temperature': round(stats['avg_temperature'], 1),
        'total_system_power': round(stats['total_power_consumed'], 2),
        'thermal_throttling_events': stats['thermal_throttling_events']
    }
    
    return {
        'cores': final_stats,
        'global': global_stats
    }

if __name__ == '__main__':
    socketio.run(app, debug=True, port=5000)
