import type { MetadataRoute } from 'next';
export default function manifest(): MetadataRoute.Manifest { return { name:'MercadoFood', short_name:'MercadoFood', description:'Gestão de pedidos, cozinha e entregas.', start_url:'/', display:'standalone', background_color:'#063D2F', theme_color:'#063D2F', icons:[{src:'/mercadofood-icon.svg',sizes:'any',type:'image/svg+xml'}] }; }
