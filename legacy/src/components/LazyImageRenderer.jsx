import React from 'react';
import DOMPurify from 'dompurify';

const LazyImageRenderer = ({ htmlContent }) => {
  const sanitizedHtml = DOMPurify.sanitize(htmlContent, {
    ADD_ATTR: ['loading'],
    FORBID_TAGS: ['script'], // Forbid script tags for security
  });

  // Parse the sanitized HTML and add loading="lazy" to img tags
  const parser = new DOMParser();
  const doc = parser.parseFromString(sanitizedHtml, 'text/html');
  doc.querySelectorAll('img').forEach(img => {
    img.setAttribute('loading', 'lazy');
  });

  return (
    <div dangerouslySetInnerHTML={{ __html: doc.body.innerHTML }} />
  );
};

export default LazyImageRenderer;
