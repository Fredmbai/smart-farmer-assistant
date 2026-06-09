from datetime import date

from celery import shared_task

from .models import MarketPrice


@shared_task
def scrape_nafis_prices():
    """
    Scrape potato prices from NAFIS Kenya.
    Runs every Monday at 6am via Celery Beat.
    Falls back gracefully if scraping fails.
    """
    import requests
    from bs4 import BeautifulSoup

    NAFIS_URL = 'http://www.nafis.go.ke/category/site-market/'

    try:
        headers = {'User-Agent': 'Mozilla/5.0 (compatible; SmartFarmer/1.0)'}
        response = requests.get(NAFIS_URL, timeout=15, headers=headers)

        if response.status_code != 200:
            print(f"NAFIS returned {response.status_code}")
            return {'status': 'failed', 'reason': f'HTTP {response.status_code}'}

        soup = BeautifulSoup(response.text, 'html.parser')
        tables = soup.find_all('table')
        prices_found = []

        for table in tables:
            for row in table.find_all('tr'):
                cells = row.find_all(['td', 'th'])
                text = [c.get_text(strip=True).lower() for c in cells]
                if any('potato' in t for t in text):
                    try:
                        price_text = [t for t in text if any(c.isdigit() for c in t)]
                        if price_text:
                            price = float(''.join(
                                c for c in price_text[0] if c.isdigit() or c == '.'
                            ))
                            if 10 < price < 500:   # sanity check KES range
                                prices_found.append(price)
                    except Exception:
                        continue

        if prices_found:
            avg_price = sum(prices_found) / len(prices_found)
            MarketPrice.objects.create(
                crop='potato',
                price_per_kg=avg_price,
                market_name='NAFIS Kenya',
                county='National Average',
                price_date=date.today(),
                source='scraped',
            )
            print(f"NAFIS: scraped potato price KES {avg_price:.2f}/kg")
            return {'status': 'success', 'price': round(avg_price, 2)}

        print("NAFIS: no potato prices found in page")
        return {'status': 'no_data'}

    except Exception as e:
        print(f"NAFIS scrape failed: {e}")
        return {'status': 'failed', 'reason': str(e)}
