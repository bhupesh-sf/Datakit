import { Helmet } from 'react-helmet-async'

interface SEOProps {
  title?: string
  description?: string
  keywords?: string
  image?: string
  url?: string
  type?: string
  siteName?: string
  author?: string
  locale?: string
  themeColor?: string
  appleTouchIcon?: string
  favicon?: string
  publishedTime?: string
  modifiedTime?: string
  category?: string
  tags?: string[]
}

export const SEO: React.FC<SEOProps> = ({
    title = 'DataKit',
    description = 'Data Toolkit',
    keywords = 'data, visualization, sql',
    url = window.location.href,
    type = 'website',
    siteName = 'DataKit, analyze your data',
    author = 'Amin Khorrami',
    locale = 'en_US',
    themeColor = '#000000',
    appleTouchIcon = '/datakit.png',
    favicon = '/favicon.ico',
    publishedTime,
    modifiedTime,
    category,
    tags = []
  }) => {
    const fullTitle = `${title} | Analyze your data`
    const imageUrl = '/datakit.png'
  
    return (
      <Helmet>
        {/* Basic Meta Tags */}
        <title>{fullTitle}</title>
        <meta name="description" content={description} />
        <meta name="keywords" content={keywords} />
        <meta name="author" content={author} />
        <meta name="robots" content="index, follow" />
        <meta name="language" content="English" />
        <meta name="revisit-after" content="7 days" />
        <meta name="rating" content="General" />
        
        {/* Viewport and Mobile */}
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <meta name="theme-color" content={themeColor} />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        <meta name="apple-mobile-web-app-title" content={title} />
        
        {/* Favicons and Icons */}
        <link rel="icon" href={favicon} />
        <link rel="apple-touch-icon" href={appleTouchIcon} />
        <link rel="canonical" href={url} />
        
        {/* Open Graph Tags */}
        <meta property="og:title" content={fullTitle} />
        <meta property="og:description" content={description} />
        <meta property="og:image" content={imageUrl} />
        <meta property="og:image:width" content="1200" />
        <meta property="og:image:height" content="630" />
        <meta property="og:image:alt" content={description} />
        <meta property="og:url" content={url} />
        <meta property="og:type" content={type} />
        <meta property="og:site_name" content={siteName} />
        <meta property="og:locale" content={locale} />
        {publishedTime && <meta property="article:published_time" content={publishedTime} />}
        {modifiedTime && <meta property="article:modified_time" content={modifiedTime} />}
        {author && <meta property="article:author" content={author} />}
        {category && <meta property="article:section" content={category} />}
        {tags.map((tag, index) => (
          <meta key={index} property="article:tag" content={tag} />
        ))}
        
        {/* Twitter Card Tags */}
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content={fullTitle} />
        <meta name="twitter:description" content={description} />
        <meta name="twitter:image" content={imageUrl} />
        <meta name="twitter:image:alt" content={description} />
        <meta name="twitter:creator" content="@yourtwitterhandle" />
        <meta name="twitter:site" content="@yourtwitterhandle" />
        
        {/* Additional SEO and Schema.org */}
        <meta name="application-name" content={siteName} />
        <meta name="msapplication-TileColor" content={themeColor} />
        <meta name="msapplication-config" content="/browserconfig.xml" />
        
        {/* Security Headers */}
        <meta httpEquiv="X-Content-Type-Options" content="nosniff" />
        <meta httpEquiv="X-Frame-Options" content="DENY" />
        <meta httpEquiv="X-XSS-Protection" content="1; mode=block" />
        
        {/* Structured Data for better search results */}
        <script type="application/ld+json">
          {JSON.stringify({
            "@context": "https://schema.org",
            "@type": "WebApplication",
            "name": siteName,
            "description": description,
            "url": url,
            "applicationCategory": "BusinessApplication",
            "operatingSystem": "Web Browser",
            "author": {
              "@type": "Person",
              "name": author
            },
            "image": imageUrl
          })}
        </script>
      </Helmet>
    )
}