import { defineConfig, devices } from '@playwright/test';
export default defineConfig({
  testDir:'./tests/e2e',timeout:45000,fullyParallel:false,workers:1,retries:0,
  reporter:[['list'],['html',{open:'never'}]],
  use:{baseURL:'http://127.0.0.1:4173',trace:'retain-on-failure',screenshot:'only-on-failure'},
  projects:[
    {name:'desktop-chromium',use:{...devices['Desktop Chrome'],viewport:{width:1366,height:900}}},
    {name:'mobile-chromium',use:{...devices['Pixel 7'],viewport:{width:390,height:844}}},
    {name:'mobile-webkit',use:{...devices['iPhone 13'],viewport:{width:375,height:812}}},
  ],
  webServer:{command:'npm run preview -- --host 127.0.0.1 --port 4173',url:'http://127.0.0.1:4173',reuseExistingServer:!process.env.CI,timeout:60000},
});
