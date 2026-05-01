import json
import os
import sys

import django

# Bootstrap Django before any model imports
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'core.settings')
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
django.setup()

import paho.mqtt.client as mqtt
from paho.mqtt.client import CallbackAPIVersion
from django.conf import settings

from farms.models import Plot
from iot.models import SensorReading


def on_connect(client, userdata, flags, reason_code, properties):
    print(f"[MQTT] Connected (rc={reason_code}). Subscribing to smartfarmer/#")
    client.subscribe('smartfarmer/#')


def on_message(client, userdata, msg):
    topic = msg.topic
    parts = topic.split('/')

    # Expected: smartfarmer/{farm_id}/{plot_id}/readings
    if len(parts) != 4 or parts[3] != 'readings':
        return

    plot_id = parts[2]

    try:
        payload = json.loads(msg.payload.decode('utf-8'))
    except (json.JSONDecodeError, UnicodeDecodeError) as e:
        print(f"[MQTT] Bad payload on {topic}: {e}")
        return

    try:
        plot = Plot.objects.get(id=plot_id)
    except Plot.DoesNotExist:
        print(f"[MQTT] Plot {plot_id} not found, skipping.")
        return

    reading = SensorReading.objects.create(
        plot=plot,
        source='mqtt',
        moisture=payload.get('moisture'),
        ph=payload.get('ph'),
        temperature=payload.get('temperature'),
        humidity=payload.get('humidity'),
        npk_n=payload.get('npk_n'),
        npk_p=payload.get('npk_p'),
        npk_k=payload.get('npk_k'),
        raw_payload=payload,
    )

    print(f"[MQTT] Saved reading {reading.id} for plot {plot_id}")

    try:
        from engine.tasks import run_engine_for_plot
        run_engine_for_plot.delay(str(plot.id))
    except Exception:
        pass


def main():
    client = mqtt.Client(CallbackAPIVersion.VERSION2)
    client.on_connect = on_connect
    client.on_message = on_message

    print(f"[MQTT] Connecting to {settings.MQTT_BROKER_HOST}:{settings.MQTT_BROKER_PORT}")
    client.connect(
        settings.MQTT_BROKER_HOST,
        settings.MQTT_BROKER_PORT,
        keepalive=60,
    )
    client.loop_forever()


if __name__ == '__main__':
    main()
