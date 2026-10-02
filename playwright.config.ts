import { defineConfig, devices } from '@playwright/test';
const port = Number(process.env.SPARTAN_TEST_PORT || 4173);
export default defineConfig({
  testDir:'./tests/e2e',timeout:45000,fullyParallel:false,workers:1,retries:0,
  reporter:[['list'],['html',{open:'never'}]],
  use:{baseURL:`http://127.0.0.1:${port}`,trace:'retain-on-failure',screenshot:'only-on-failure'},
  projects:[
    {name:'desktop-chromium',use:{...devices['Desktop Chrome'],viewport:{width:1366,height:900}}},
    {name:'mobile-chromium',use:{...devices['Pixel 7'],viewport:{width:390,height:844}}},
    {name:'mobile-webkit',use:{...devices['iPhone 13'],viewport:{width:375,height:812}}},
  ],
  webServer:{command:`npm run preview -- --host 127.0.0.1 --port ${port} --strictPort`,url:`http://127.0.0.1:${port}`,reuseExistingServer:false,timeout:60000},
});
