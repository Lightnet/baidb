console.log("Hello via Bun!");

import { Elysia } from 'elysia';
import { html } from '@elysiajs/html';
import { staticPlugin } from '@elysiajs/static';
import { cookie } from '@elysiajs/cookie';
import van from "mini-van-plate/van-plate";

const {head, body, style, script} = van.tags

function scriptHtml02(_script){
  //background:gray;
  const pageHtml = van.html(
    head(
      style(`
      body{
        margin: 0px 0px 0px 0px;
        overflow: hidden;
      }
      `),
      script({type:"importmap"},`{
  "imports": {
    "vanjs-core":"https://cdn.jsdelivr.net/npm/vanjs-core@1.6.0/src/van.min.js",
    "van":"https://cdn.jsdelivr.net/gh/vanjs-org/van/public/van-1.6.0.min.js",
    "vanjs-ui":"https://cdn.jsdelivr.net/npm/vanjs-ui@0.11.14/dist/van-ui.min.js",
    "vanjs-ext":"https://cdn.jsdelivr.net/npm/vanjs-ext@0.6.3/src/van-x.js",
    "vanjs-routing":"https://cdn.jsdelivr.net/npm/vanjs-routing@1.1.4/dist/index.min.js"
  }
}
`),
    ),
    body(
      script({type:"module",src:_script})
    ),
  );

  return pageHtml;
}

const app = new Elysia();
app.use(cookie()) // Initialize the cookie plugin
app.use(html())
app.use(staticPlugin({
        assets: 'public', // Directory where your static files are located
        prefix: '', // Optional: prefix for accessing static files
        alwaysStatic: false, //
        maxAge: 0,
        // noCache: process.env.NODE_ENV !== 'production',
    }));
app.get('/',({ html }) => html(
  scriptHtml02("index.js")
));
console.log("process");
// console.log(process);
console.log(process.env.PORT)

console.log("Bun");
// console.log(Bun);
console.log(Bun.env.PORT)

const port = Bun.env.PORT || 3000;

app.listen(port);

const localString = new Date().toLocaleString();
// console.log(localString); 
console.log(`SERVER: http://127.0.0.1:${port} ` + localString);
