const YORIAX_IOS_APP_ID = '3H83CGSR39.com.yoriax.app';

export const appleAppSiteAssociation = {
  applinks: {
    apps: [],
    details: [
      {
        appID: YORIAX_IOS_APP_ID,
        paths: [
          '/',
          '/song/*',
          '/artist/*',
          '/playlist/*',
          '/playlists',
          '/discover/playlists',
          '/artists',
          '/collection/tracks',
          '/feed',
        ],
      },
    ],
  },
};

export function createAppleAppSiteAssociationResponse() {
  return Response.json(appleAppSiteAssociation, {
    headers: {
      'Cache-Control': 'public, max-age=3600, s-maxage=3600',
      'Content-Type': 'application/json',
    },
  });
}
