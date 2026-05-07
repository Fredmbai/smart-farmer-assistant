import argparse
import json
import random
import time
from datetime import datetime, timezone

import paho.mqtt.client as mqtt
from paho.mqtt.client import CallbackAPIVersion

SCENARIOS = {
    'healthy': {
        'moisture': 60, 'ph': 6.0, 'temperature': 18, 'humidity': 70,
        'npk_n': 80, 'npk_p': 40, 'npk_k': 60,
    },
    'low_moisture': {
        'moisture': 8,  'ph': 6.0, 'temperature': 18, 'humidity': 65,
        'npk_n': 80, 'npk_p': 40, 'npk_k': 60,
    },
    'late_blight_risk': {
        'moisture': 88, 'ph': 6.0, 'temperature': 15, 'humidity': 92,
        'npk_n': 80, 'npk_p': 40, 'npk_k': 60,
    },
    'ph_problem': {
        'moisture': 60, 'ph': 4.1, 'temperature': 18, 'humidity': 70,
        'npk_n': 80, 'npk_p': 40, 'npk_k': 60,
    },
    'frost_risk': {
        'moisture': 55, 'ph': 6.0, 'temperature': 1,  'humidity': 85,
        'npk_n': 80, 'npk_p': 40, 'npk_k': 60,
    },
}


def simulate_reading(base_value, drift=0.05, spike_chance=0.03):
    value = base_value * (1 + random.uniform(-drift, drift))
    if random.random() < spike_chance:
        value *= 0.3
    return round(value, 2)


def build_payload(farm_id, plot_id, scenario_values):
    now = datetime.now(timezone.utc).isoformat()
    return {
        'farm_id':     farm_id,
        'plot_id':     plot_id,
        'timestamp':   now,
        'crop':        'potato',
        'moisture':    simulate_reading(scenario_values['moisture']),
        'ph':          simulate_reading(scenario_values['ph'],          drift=0.02),
        'temperature': simulate_reading(scenario_values['temperature'], drift=0.05),
        'humidity':    simulate_reading(scenario_values['humidity']),
        'npk_n':       simulate_reading(scenario_values['npk_n']),
        'npk_p':       simulate_reading(scenario_values['npk_p']),
        'npk_k':       simulate_reading(scenario_values['npk_k']),
    }


def publish_reading(client, farm_id, plot_id, scenario_values, dry_run=False):
    payload = build_payload(farm_id, plot_id, scenario_values)
    topic = f"smartfarmer/{farm_id}/{plot_id}/readings"

    if not dry_run:
        client.publish(topic, json.dumps(payload))

    label = '[DRY-RUN]' if dry_run else '[Published]'
    print(
        f"[{payload['timestamp']}] {label} → topic: {topic}\n"
        f"  moisture: {payload['moisture']}%  |  "
        f"pH: {payload['ph']}  |  "
        f"temp: {payload['temperature']}°C  |  "
        f"humidity: {payload['humidity']}%"
    )


def main():
    parser = argparse.ArgumentParser(description='Smart Farmer sensor simulator')
    parser.add_argument('--scenario',  choices=SCENARIOS.keys(), default='healthy')
    parser.add_argument('--farm-id',   default='farm_001')
    parser.add_argument('--plot-id',   default='plot_001')
    parser.add_argument('--interval',  type=int, default=30,
                        help='Seconds between readings')
    parser.add_argument('--host',      default='localhost')
    parser.add_argument('--port',      type=int, default=1883)
    parser.add_argument('--dry-run',   action='store_true',
                        help='Print payloads without connecting to broker')
    args = parser.parse_args()

    scenario_values = SCENARIOS[args.scenario]

    print(f"[Simulator] Scenario : {args.scenario}")
    print(f"[Simulator] Farm     : {args.farm_id}  |  Plot: {args.plot_id}")
    print(f"[Simulator] Interval : {args.interval}s")

    client = None
    if args.dry_run:
        print("[Simulator] Mode     : DRY-RUN (no broker connection)\n")
    else:
        print(f"[Simulator] Broker   : {args.host}:{args.port}  (Ctrl+C to stop)\n")
        client = mqtt.Client(CallbackAPIVersion.VERSION2)
        try:
            client.connect(args.host, args.port)
            client.loop_start()
        except ConnectionRefusedError:
            print(f"[Simulator] ERROR: Could not connect to broker at "
                  f"{args.host}:{args.port}.\n"
                  f"            Start mosquitto first:  sudo apt install mosquitto && mosquitto -d")
            return

    try:
        while True:
            publish_reading(client, args.farm_id, args.plot_id,
                            scenario_values, dry_run=args.dry_run)
            time.sleep(args.interval)
    except KeyboardInterrupt:
        print('\n[Simulator] Stopped.')
    finally:
        if client:
            client.loop_stop()
            client.disconnect()


if __name__ == '__main__':
    main()
