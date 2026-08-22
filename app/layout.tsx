import type { Metadata } from 'next';
import './globals.css';
import './auth.css';
export const metadata: Metadata={title:'微创新 · 企业创新建议平台',description:'让每一个微小改进都被看见、被推动、被实现。'};
export default function RootLayout({children}:{children:React.ReactNode}){return <html lang="zh-CN"><body>{children}</body></html>}
