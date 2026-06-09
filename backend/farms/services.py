import requests


class SoilDataService:

    ISRIC_URL = 'https://rest.isric.org/soilgrids/v2.0/properties/query'

    def fetch_soil_data(self, latitude, longitude):
        """
        Fetch soil properties from ISRIC SoilGrids API.
        Free, no API key required.
        Returns estimated soil pH and organic carbon for the farm's coordinates.
        """
        try:
            # ISRIC requires repeated params (list of tuples) for multiple properties
            params = [
                ('lon', longitude),
                ('lat', latitude),
                ('property', 'phh2o'),
                ('property', 'soc'),
                ('property', 'clay'),
                ('depth', '5-15cm'),
                ('value', 'mean'),
            ]
            response = requests.get(self.ISRIC_URL, params=params, timeout=15)

            if response.status_code != 200:
                print(f"ISRIC API returned {response.status_code}")
                return None

            data = response.json()

            ph_value = None
            oc_value = None

            for layer in data.get('properties', {}).get('layers', []):
                depths = layer.get('depths', [])
                if not depths:
                    continue
                mean = depths[0].get('values', {}).get('mean')
                if mean is None:
                    continue

                name = layer.get('name')
                # d_factor in unit_measure tells us the divisor (phh2o → pH*10, soc → g/kg*10)
                d_factor = layer.get('unit_measure', {}).get('d_factor', 1)

                if name == 'phh2o':
                    ph_value = round(mean / d_factor, 2)
                elif name == 'soc':
                    oc_value = round(mean / d_factor, 2)

            return {
                'soil_ph_estimate': ph_value,
                'organic_carbon':   oc_value,
                'source':           'ISRIC SoilGrids',
            }

        except Exception as e:
            print(f"ISRIC API error: {e}")
            return None
