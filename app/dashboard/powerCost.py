import cpuinfo
from flask import jsonify 
import psutil
import json
from pathlib import Path
from datetime import datetime
from flask import jsonify
import re
CONFIG_COST_PATH = Path(__file__).resolve().parent / "config_cost.json"
CPU_INFO = cpuinfo.get_cpu_info()

class powerGetCost:

    @staticmethod
    def get_tdp_smart():
        cpu_name = CPU_INFO.get('brand_raw', 'Unknown')
        # Lista de CPUs con TDP específicos
        SPECIFIC_TDP = {
            "Xeon E5-2695 v4": 120.0,
            "Xeon E5-2620 v3": 85.0,
            "Intel Core i5-6300U": 15.0,
            "AMD Ryzen 9 5950X": 105.0,
            }
        
        cpu_name_upper = cpu_name.upper()
        
        # --- NIVEL 1: Búsqueda exacta en el Diccionario de Precisión ---
        for model, tdp in SPECIFIC_TDP.items():
            if model.upper() in cpu_name_upper:
                return tdp

        # --- NIVEL 2: Lógica de Sufijos (Muy precisa para laptops y desktops) ---
        suffix_match = re.search(r'(\d+)([A-Z]+)', cpu_name_upper)
        if suffix_match:
            suffix = suffix_match.group(2)
            sufijos = {
                'U': 15.0, 'Y': 7.0,        # Ultra bajo consumo
                'H': 45.0, 'HS': 35.0, 'HX': 55.0, 'HQ': 45.0, # Alto rendimiento laptop
                'T': 35.0,                 # Desktop bajo consumo
                'K': 125.0, 'KF': 125.0, 'X': 105.0 # Entusiasta / Overclock
            }
            if suffix in sufijos:
                return sufijos[suffix]

        # --- NIVEL 3: Lógica por Familias (Promedios conservadores) ---
        # Para los Xeon, usamos un promedio más realista si no conocemos el modelo
        if "XEON" in cpu_name_upper:
            # Si es un Xeon E3 (entrada), suele ser menos. Si es E5/E7, más.
            if "E3" in cpu_name_upper: return 80.0
            if "E5" in cpu_name_upper or "E7" in cpu_name_upper: return 120.0
            return 130.0 # Promedio general Xeon
        
        if "EPYC" in cpu_name_upper: return 225.0
        

            # ARM / Raspberry Pi
        if "CORTEX-A53" in cpu_name_upper:
            return 4.0   # Raspberry Pi 3

        if "CORTEX-A72" in cpu_name_upper:
            return 5.0   # Raspberry Pi 4 (algunas versiones)

        if "CORTEX-A76" in cpu_name_upper:
            return 10.0  # Raspberry Pi 5

        if "RASPBERRY" in cpu_name_upper or "ARM" in cpu_name_upper or "CORTEX" in cpu_name_upper:
            return 7.0   # ARM genérico
        
        # Gamas estándar
        if "I3" in cpu_name_upper: return 35.0
        if "I5" in cpu_name_upper: return 65.0
        if "I7" in cpu_name_upper: return 95.0
        if "I9" in cpu_name_upper: return 125.0
        if "RYZEN" in cpu_name_upper: return 65.0

        # --- NIVEL 4: Valor por defecto ---
        return 35.0

    
    @staticmethod
    def getPowerCost():

        '''Estimación base W'''
        cpu_percent = psutil.cpu_percent(interval=0.1)
        base_power = 2.5
        max_power = 5.0
        pbase = 0
        freq = psutil.cpu_freq()
        cpu_freq = psutil.cpu_freq().current
        cpu_freq_max = psutil.cpu_freq().max

        if freq and cpu_freq_max > 0 and cpu_freq != cpu_freq_max:
            cpu_freq_factor = 0.35 + 0.65 * (freq.current / freq.max)
        else:
            cpu_freq_factor = 1.0

        cpu_power = base_power + (max_power - base_power) * (cpu_percent / 100) * cpu_freq_factor
        estimated = pbase + cpu_power 
        print(estimated)


        with CONFIG_COST_PATH.open(encoding="utf-8") as f:
            config_cost = json.load(f)

        
        if config_cost is None:
            return jsonify(diary_cost)
        
        if config_cost['p1'] == 0 and config_cost['p2'] == 0 and config_cost['p3'] == 0:
            
            precio_kwh = config_cost["precio_kwh"]
            coste_base = (round(estimated, 2)/1000) * precio_kwh               
            iva = config_cost["iva"]
            coste_con_iva = coste_base * (1 + iva)

            coste_hora = coste_base / 1
          

            """Coste diario estimado con 24h"""
            coste_base_24 = coste_hora * 24 
            coste_con_iva_24 = coste_base_24 * (1 + iva)

            """Coste mensual estimado"""
            coste_base_mensual = coste_base_24 * 30
            coste_con_iva_mensual = coste_base_mensual * (1 + iva)

            """Coste anual estimado"""
            coste_base_anual = coste_base_24 * 365
            coste_con_iva_anual = coste_base_anual * (1 + iva) 

            cost={"cost":(f"{coste_con_iva:.8f}")}
            cost_24={"cost_24":(f"{coste_con_iva_24:.8f}")}
            cost_mensual={"cost_mensual":(f"{coste_con_iva_mensual:.8f}")}
            cost_anual={"cost_anual":(f"{coste_con_iva_anual:.8f}")}


        return jsonify({
        "cost": cost,
        "cost_24": cost_24,
        "cost_mensual": cost_mensual,
        "cost_anual": cost_anual
    })


    @staticmethod
    def get_energy_plan():
        try:
            output = Path("/sys/devices/system/cpu/cpu0/cpufreq/scaling_governor").read_text().strip()

            match output:
                case "performance":
                        return output + " (Rendimiento)"
                case "balanced":
                        return output + " (Equilibrado)"
                case "power-saver":
                        return output + " (Ahorro de energía)"
                case _:
                        return output
           
            

            return output

        except:
            output = 0
            return output


    @staticmethod
    def get_boot_time():
        try:
            boot_time = psutil.boot_time()
            uptime = datetime.now() - datetime.fromtimestamp(boot_time)
            mins = int(uptime.total_seconds() // 60)
            hours = mins // 60
            minutes = mins % 60
            return hours, minutes   
        except:
            minutes = 0
            hours = 0
            return hours, minutes

    
