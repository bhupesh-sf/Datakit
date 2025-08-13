import {
  createCorsOriginChecker,
  isOriginAllowed,
  parseAllowedOrigins,
} from './cors.utils';

describe('CORS Utils', () => {
  describe('isOriginAllowed', () => {
    describe('localhost wildcards', () => {
      it('should allow localhost with any port when using localhost:*', () => {
        const allowedOrigins = ['localhost:*'];

        expect(isOriginAllowed('http://localhost:3000', allowedOrigins)).toBe(
          true,
        );
        expect(isOriginAllowed('http://localhost:5173', allowedOrigins)).toBe(
          true,
        );
        expect(isOriginAllowed('https://localhost:8080', allowedOrigins)).toBe(
          true,
        );
        expect(isOriginAllowed('http://127.0.0.1:3000', allowedOrigins)).toBe(
          true,
        );
        expect(isOriginAllowed('https://127.0.0.1:443', allowedOrigins)).toBe(
          true,
        );
      });

      it('should allow localhost with specific protocol', () => {
        const allowedOrigins = ['http://localhost:*'];

        expect(isOriginAllowed('http://localhost:3000', allowedOrigins)).toBe(
          true,
        );
        expect(isOriginAllowed('http://127.0.0.1:3000', allowedOrigins)).toBe(
          true,
        );
        expect(isOriginAllowed('https://localhost:3000', allowedOrigins)).toBe(
          false,
        );
      });

      it('should allow 127.0.0.1 with wildcard', () => {
        const allowedOrigins = ['127.0.0.1:*'];

        expect(isOriginAllowed('http://127.0.0.1:3000', allowedOrigins)).toBe(
          true,
        );
        expect(isOriginAllowed('http://localhost:3000', allowedOrigins)).toBe(
          true,
        );
        expect(isOriginAllowed('https://127.0.0.1:8080', allowedOrigins)).toBe(
          true,
        );
      });
    });

    describe('domain wildcards', () => {
      it('should allow subdomains with wildcard', () => {
        const allowedOrigins = ['*.datakit.page'];

        expect(
          isOriginAllowed('https://app.datakit.page', allowedOrigins),
        ).toBe(true);
        expect(
          isOriginAllowed('https://staging.datakit.page', allowedOrigins),
        ).toBe(true);
        expect(
          isOriginAllowed('http://test.datakit.page', allowedOrigins),
        ).toBe(true);
        expect(isOriginAllowed('https://datakit.page', allowedOrigins)).toBe(
          true,
        );
      });

      it('should not allow different domains with wildcard', () => {
        const allowedOrigins = ['*.datakit.page'];

        expect(isOriginAllowed('https://example.com', allowedOrigins)).toBe(
          false,
        );
        expect(isOriginAllowed('https://datakit.com', allowedOrigins)).toBe(
          false,
        );
      });
    });

    describe('exact matches', () => {
      it('should allow exact origin matches', () => {
        const allowedOrigins = [
          'https://datakit.page',
          'http://localhost:3000',
        ];

        expect(isOriginAllowed('https://datakit.page', allowedOrigins)).toBe(
          true,
        );
        expect(isOriginAllowed('http://localhost:3000', allowedOrigins)).toBe(
          true,
        );
      });

      it('should not allow different origins', () => {
        const allowedOrigins = ['https://datakit.page'];

        expect(isOriginAllowed('http://datakit.page', allowedOrigins)).toBe(
          false,
        );
        expect(isOriginAllowed('https://example.com', allowedOrigins)).toBe(
          false,
        );
      });
    });

    describe('partial domain matches', () => {
      it('should allow domain without protocol', () => {
        const allowedOrigins = ['datakit.page', 'app.datakit.page'];

        expect(isOriginAllowed('https://datakit.page', allowedOrigins)).toBe(
          true,
        );
        expect(isOriginAllowed('http://datakit.page', allowedOrigins)).toBe(
          true,
        );
        expect(
          isOriginAllowed('https://app.datakit.page', allowedOrigins),
        ).toBe(true);
        expect(isOriginAllowed('http://app.datakit.page', allowedOrigins)).toBe(
          true,
        );
      });

      it('should not allow subdomains when exact domain specified', () => {
        const allowedOrigins = ['datakit.page'];

        expect(
          isOriginAllowed('https://app.datakit.page', allowedOrigins),
        ).toBe(false);
      });
    });

    describe('mixed patterns', () => {
      it('should handle multiple patterns correctly', () => {
        const allowedOrigins = [
          'localhost:*',
          '*.datakit.page',
          'https://production.example.com',
          'staging.example.com',
        ];

        // Localhost patterns
        expect(isOriginAllowed('http://localhost:3000', allowedOrigins)).toBe(
          true,
        );
        expect(isOriginAllowed('https://127.0.0.1:8080', allowedOrigins)).toBe(
          true,
        );

        // Subdomain wildcard
        expect(
          isOriginAllowed('https://app.datakit.page', allowedOrigins),
        ).toBe(true);
        expect(
          isOriginAllowed('https://api.datakit.page', allowedOrigins),
        ).toBe(true);

        // Exact match
        expect(
          isOriginAllowed('https://production.example.com', allowedOrigins),
        ).toBe(true);

        // Partial domain match
        expect(
          isOriginAllowed('https://staging.example.com', allowedOrigins),
        ).toBe(true);
        expect(
          isOriginAllowed('http://staging.example.com', allowedOrigins),
        ).toBe(true);

        // Should not allow
        expect(isOriginAllowed('https://example.com', allowedOrigins)).toBe(
          false,
        );
        expect(isOriginAllowed('https://malicious.site', allowedOrigins)).toBe(
          false,
        );
      });
    });
  });

  describe('createCorsOriginChecker', () => {
    it('should allow requests with no origin', (done) => {
      const checker = createCorsOriginChecker(['https://datakit.page']);

      checker(undefined, (err, allow) => {
        expect(err).toBeNull();
        expect(allow).toBe(true);
        done();
      });
    });

    it('should allow matching origins', (done) => {
      const checker = createCorsOriginChecker([
        'localhost:*',
        'https://datakit.page',
      ]);

      checker('http://localhost:3000', (err, allow) => {
        expect(err).toBeNull();
        expect(allow).toBe(true);
        done();
      });
    });

    it('should reject non-matching origins', (done) => {
      const checker = createCorsOriginChecker(['https://datakit.page']);

      checker('https://malicious.site', (err, allow) => {
        expect(err).toBeInstanceOf(Error);
        expect(err?.message).toBe('Not allowed by CORS');
        expect(allow).toBeUndefined();
        done();
      });
    });
  });

  describe('parseAllowedOrigins', () => {
    it('should parse comma-separated origins', () => {
      const result = parseAllowedOrigins(
        'localhost:*, *.datakit.page, https://example.com',
      );

      expect(result).toEqual([
        'localhost:*',
        '*.datakit.page',
        'https://example.com',
      ]);
    });

    it('should handle extra spaces', () => {
      const result = parseAllowedOrigins('  localhost:*  ,   *.datakit.page  ');

      expect(result).toEqual(['localhost:*', '*.datakit.page']);
    });

    it('should filter empty strings', () => {
      const result = parseAllowedOrigins('localhost:*,, ,*.datakit.page');

      expect(result).toEqual(['localhost:*', '*.datakit.page']);
    });

    it('should return default origins when input is undefined', () => {
      const defaultOrigins = ['http://localhost:3000'];
      const result = parseAllowedOrigins(undefined, defaultOrigins);

      expect(result).toEqual(defaultOrigins);
    });

    it('should return empty array when input is undefined and no defaults', () => {
      const result = parseAllowedOrigins(undefined);

      expect(result).toEqual([]);
    });
  });
});
