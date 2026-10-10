import sys, asyncio
from playwright.async_api import async_playwright
async def main(url,out,w,h,wait):
    async with async_playwright() as p:
        b=await p.chromium.launch(executable_path='/usr/bin/google-chrome',args=['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--autoplay-policy=no-user-gesture-required'])
        pg=await b.new_page(viewport={'width':w,'height':h})
        pg.on('console',lambda m: print('CONSOLE',m.text))
        pg.on('pageerror',lambda e: print('PAGEERR',e))
        await pg.goto(url); await pg.wait_for_timeout(wait)
        await pg.screenshot(path=out); await b.close()
asyncio.run(main(sys.argv[1],sys.argv[2],int(sys.argv[3]),int(sys.argv[4]),int(sys.argv[5])))
