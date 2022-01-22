// import { Router } from '@vaadin/router';

// window.addEventListener('load', () => {
//   initRouter();
// });

// const initRouter = () => {
//   const routerOutput = document.querySelector('#router-output');
//   const router = new Router(routerOutput,);
//   router.setRoutes([
//     {
//       path: '/index.html',
//       component: 'student-page'
//     },   
//     {
//       path: '/crud-page',
//       component: crudPage
//     },   
//     {
//       path: '/page-not-found.js',
//       component: 'cursuscoordinator-page.js'
//     },   
//     {
//       path: '/prfed-2122-v2a-team-ye/crud-page',
//       component: 'crud-page'
//     },  
//     {
//       path: '(.*)',
//       component: 'page-not-found'
//     }
//   ]);
// }

// const outlet = document.querySelector('#router-output');

// const router = new Router(outlet);
// router.setRoutes([
//   {path:'/prfed-2122-v2a-team-ye/', component: 'crud-page'},
//   {path:'/prfed-2122-v2a-team-ye/', component: 'student-page'}
// ]);


import { Router } from './../../node_modules/@vaadin/router/dist/vaadin-router.js';

window.addEventListener('load', () => {
    initRouter();
});

const initRouter = () => {
    const routerOutput = document.querySelector('#router-output');
    const router = new Router(routerOutput);
    router.setRoutes([
        {
            path: '/',
            component: 'cursuscoordinator-page',
            action: () => import('../view/pages/cursuscoordinator-page.js')
        },
        {
            path: '/index.html',
            component: 'student-page'
        },
        {
            path: '/crud',
            component: 'crud-page'
        },
        {
            path: '/nieuw-vak',
            component: 'crud-page',
            action: () => import('../view/pages/crud-page.js')
        },
        {
            path: '/login',
            component: 'student-page',
            action: () => import('../view/pages/student-page.js')
        },
        {
            path: '/vak-edit',
            component: 'cursuscoordinator-page',
            action: () => import('../view/pages/cursuscoordinator-page')
        },
        {
            path: '(.*)',
            component: 'page-not-found'
        }
    ])
}