import sys, asyncio, json
from playwright.async_api import async_playwright
# usage: play.py out_prefix script.json  (list of steps)
async def main(prefix, steps, w, h):
    async with async_playwright() as p:
        b=await p.chromium.launch(executable_path='/usr/bin/google-chrome',args=['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--autoplay-policy=no-user-gesture-required'])
        pg=await b.new_page(viewport={'width':w,'height':h},device_scale_factor=float(__import__('os').environ.get('DPR','1')),has_touch=bool(__import__('os').environ.get('TOUCH')))
        pg.on('console',lambda m: print('CONSOLE',m.type,m.text) if m.type in ('error','warning') else None)
        pg.on('pageerror',lambda e: print('PAGEERR',e))
        await pg.goto('http://127.0.0.1:18473/index.html?autostart&debug')
        await pg.evaluate("localStorage.clear()")
        await pg.reload(); await pg.wait_for_timeout(2500)
        for s in steps:
            k=s[0]
            if k=='wait': await pg.wait_for_timeout(s[1])
            elif k=='js': r=await pg.evaluate(s[1]); print('JS',r)
            elif k=='shot': await pg.screenshot(path=f'{prefix}_{s[1]}.png'); print('shot',s[1])
            elif k=='click': await pg.mouse.click(s[1],s[2])
            elif k=='drag':
                await pg.mouse.move(s[1],s[2]); await pg.mouse.down()
                for i in range(s[5]): 
                    import math
                    await pg.mouse.move(s[1]+math.sin(i*0.5)*s[3], s[2]+math.cos(i*0.37)*s[4]); await pg.wait_for_timeout(16)
                await pg.mouse.up()
        await b.close()
steps=json.loads(open(sys.argv[2]).read())
asyncio.run(main(sys.argv[1],steps,int(sys.argv[3]),int(sys.argv[4])))
