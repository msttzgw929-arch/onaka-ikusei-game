import asyncio
from playwright.async_api import async_playwright
async def main():
    async with async_playwright() as p:
        b=await p.chromium.launch(executable_path='/usr/bin/google-chrome',args=['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader'])
        pg=await b.new_page(viewport={'width':1280,'height':800})
        await pg.goto('http://127.0.0.1:18473/index.html?autostart'); await pg.wait_for_timeout(2500)
        await pg.evaluate("""(()=>{const o=World.draw;window.__wt=[];World.draw=function(...a){const t=performance.now();o.apply(this,a);__wt.push(performance.now()-t)};
          const f=Face.render;window.__ft=[];Face.render=function(...a){const t=performance.now();const r=f.apply(this,a);__ft.push(performance.now()-t);return r};
          const g=CharGL.draw;window.__gt=[];CharGL.draw=function(...a){const t=performance.now();g.apply(this,a);__gt.push(performance.now()-t)};})()""")
        for S in [0.3,9,60,400,4000,2e7]:
            await pg.evaluate(f"__game.setS({S},true);__wt.length=0;__ft.length=0;__gt.length=0")
            await pg.wait_for_timeout(2500)
            r=await pg.evaluate("[__wt,__ft,__gt].map(a=>(a.reduce((x,y)=>x+y,0)/a.length).toFixed(2))")
            print(S,'world/face/gl ms',r)
        await b.close()
asyncio.run(main())
