from flask import Flask, request, jsonify
from flask_cors import CORS
from flask_socketio import SocketIO, emit
import time
import threading
import random

app = Flask(__name__)
CORS(app)
socketio = SocketIO(app, cors_allowed_origins="*")

class Core:
    def __init__(self, core_id, frequency, power_coefficient):
        self.core_id = core_id
        self.frequency = frequency  # GHz
        self.power_coefficient = power_coefficient
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
            frequency=core_config['frequency'],
            power_coefficient=core_config['power_coefficient']
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
            frequency=core_config['frequency'],
            power_coefficient=core_config['power_coefficient']
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

if __name__ == '__main__':
    socketio.run(app, debug=True, port=5000)
