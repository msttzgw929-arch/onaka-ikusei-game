import asyncio
from playwright.async_api import async_playwright
async def main():
    async with async_playwright() as p:
        b=await p.chromium.launch(executable_path='/usr/bin/google-chrome',args=['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--autoplay-policy=no-user-gesture-required'])
        pg=await b.new_page(viewport={'width':1280,'height':800})
        pg.on('pageerror',lambda e: print('PAGEERR',e))
        await pg.goto('http://127.0.0.1:18473/index.html'); await pg.evaluate("localStorage.clear()"); await pg.reload()
        await pg.wait_for_timeout(3000); await pg.screenshot(path='work/q_title.png')
        await pg.click('#btnStart',force=True); await pg.wait_for_timeout(1500)
        await pg.evaluate("__game.state.pts=5000")
        # drag food to mouth
        box=await pg.locator('.food').first.bounding_box()
        await pg.mouse.move(box['x']+40,box['y']+40); await pg.mouse.down()
        for i in range(20): await pg.mouse.move(box['x']+40+(640-box['x']-40)*i/19, box['y']+40+(110-box['y']-40)*i/19); await pg.wait_for_timeout(20)
        await pg.screenshot(path='work/q_drag.png')
        await pg.mouse.up(); await pg.wait_for_timeout(700); await pg.screenshot(path='work/q_eat.png')
        await pg.click('#tabs button[data-tab=up]',force=True); await pg.wait_for_timeout(500); await pg.screenshot(path='work/q_up.png')
        await pg.click('.upg >> nth=0',force=True); await pg.wait_for_timeout(300)
        await pg.click('#tabs button[data-tab=food]',force=True); await pg.wait_for_timeout(300)
        await pg.click('.food.locked',force=True); await pg.wait_for_timeout(800); await pg.screenshot(path='work/q_unlock.png')
        print(await pg.evaluate("JSON.stringify(__game.state)"))
        # fps measure
        fps=await pg.evaluate("new Promise(r=>{let n=0,t0=performance.now();function f(){n++;if(performance.now()-t0<3000)requestAnimationFrame(f);else r(n/3)}requestAnimationFrame(f)})")
        print('fps',fps)
        await b.close()
asyncio.run(main())
