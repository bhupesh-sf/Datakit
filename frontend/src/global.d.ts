interface Window {
  gapi: {
    load: (apis: string, callback: () => void) => void;
    client: {
      init: (config: {
        apiKey: string;
        clientId: string;
        discoveryDocs: string[];
        scope: string;
      }) => Promise<void>;
      drive: {
        files: {
          list: (params: {
            q?: string;
            fields?: string;
            orderBy?: string;
            pageSize?: number;
          }) => Promise<{
            result: {
              files: Array<{
                id: string;
                name: string;
                mimeType: string;
                size?: string;
                modifiedTime: string;
                iconLink?: string;
                webViewLink: string;
              }>;
            };
          }>;
          get: (params: { fileId: string; fields?: string }) => Promise<{
            result: {
              id: string;
              name: string;
              mimeType: string;
              size?: string;
            };
          }>;
        };
      };
    };
    auth2: {
      getAuthInstance: () => {
        isSignedIn: {
          get: () => boolean;
        };
        signIn: () => Promise<void>;
        signOut: () => Promise<void>;
        currentUser: {
          get: () => {
            getAuthResponse: () => {
              access_token: string;
            };
          };
        };
      };
    };
  };
}
