import { isSharePayload } from '../../lib/sharePayload';
import { createSharedLink } from '../../lib/sharedLinks';

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  if (
    typeof body !== 'object' ||
    body === null ||
    !('payload' in body) ||
    !isSharePayload(body.payload)
  ) {
    return Response.json({ error: 'Invalid shared-link payload' }, { status: 400 });
  }

  try {
    const code = await createSharedLink(body.payload);
    return Response.json({ code }, { status: 201 });
  } catch (error) {
    console.error('Failed to create shared link', error);
    const isConfigurationError =
      error instanceof Error && error.message.includes('must be configured');
    return Response.json(
      { error: isConfigurationError ? 'Shared links are not configured' : 'Could not save shared link' },
      { status: isConfigurationError ? 503 : 502 }
    );
  }
}