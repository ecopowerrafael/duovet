import { QueryClient } from '@tanstack/react-query';


export const queryClientInstance = new QueryClient({
	defaultOptions: {
		queries: {
			refetchOnWindowFocus: true,
			refetchOnReconnect: true,
			retry: 1,
		},
	},
});

export async function invalidateAppDataQueries(queryClient = queryClientInstance) {
	await queryClient.invalidateQueries();
}
