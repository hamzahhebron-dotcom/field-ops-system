export const metadata = {
  title: 'Field Ops System',
  description: 'Private field operations monitoring',
}

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body style={{ margin: 0, fontFamily: 'sans-serif', background: '#f4f4f4' }}>
        {children}
      </body>
    </html>
  )
}