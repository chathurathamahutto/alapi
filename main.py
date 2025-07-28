from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse
import requests
from bs4 import BeautifulSoup

app = FastAPI()

@app.get("/search")
async def search(q: str = ""):
    if not q:
        return JSONResponse({"status": False, "message": "Missing search query"}, status_code=400)

    search_url = f"https://www.alevelapi.com/?s={q}"
    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)"
    }

    try:
        res = requests.get(search_url, headers=headers, timeout=10)
        soup = BeautifulSoup(res.text, "html.parser")

        results = []

        for item in soup.select("article, .post"):
            title_tag = item.select_one("h2 a")
            if not title_tag:
                continue

            title = title_tag.text.strip()
            link = title_tag["href"]

            # Try to find a PDF inside the linked page
            try:
                sub_res = requests.get(link, headers=headers, timeout=10)
                sub_soup = BeautifulSoup(sub_res.text, "html.parser")
                pdf_link = None
                for a_tag in sub_soup.select("a[href$='.pdf']"):
                    href = a_tag["href"]
                    if href.startswith("http"):
                        pdf_link = href
                    else:
                        pdf_link = link + href
                    break

                if pdf_link:
                    results.append({
                        "subject": title,
                        "link": link,
                        "downloadDetails": {
                            "title": title,
                            "download": pdf_link
                        }
                    })

            except:
                continue

        return JSONResponse({
            "status": True,
            "results": results
        })

    except Exception as e:
        return JSONResponse({
            "status": False,
            "message": str(e)
        })
