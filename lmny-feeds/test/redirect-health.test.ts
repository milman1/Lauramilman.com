import {expect,it,vi} from 'vitest';
import {checkRedirect} from '../src/redirectHealth.mjs';
const row={path:'/products/lg-123',target:'/collections/lab-grown-diamonds?lmny_redirect=lg-123'};
it('checks final destination and marker, detects 404s and loops',async()=>{
  const mock=(location:string,status=200)=>vi.fn()
    .mockResolvedValueOnce(new Response(null,{status:301,headers:{location}}))
    .mockResolvedValue(new Response(null,{status}));
  expect((await checkRedirect(row,mock(row.target))).status).toBe('redirect_ok');
  expect((await checkRedirect(row,mock('/collections/lab-grown-diamonds'))).status).toBe('lost_filter_or_marker');
  expect((await checkRedirect(row,mock(row.target,404))).status).toBe('http_404');
  expect((await checkRedirect(row,mock(row.path))).status).toBe('loop');
});
it('never requests an external target and recognizes restored live products',async()=>{
  const f=vi.fn().mockResolvedValue(new Response(null,{status:301,headers:{location:'https://other.example/'}}));
  expect((await checkRedirect(row,f)).status).toBe('external_target');
  expect(f).toHaveBeenCalledTimes(1);
  expect((await checkRedirect(row,vi.fn().mockResolvedValue(new Response(null,{status:200})))).status).toBe('live_product');
});
