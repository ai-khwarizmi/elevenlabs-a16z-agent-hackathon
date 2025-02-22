let exampleState = $state();

export const appState = {
	get example() {
		return exampleState;
	},
	set example(value) {
		exampleState = value;
		// save to local storage / indexdb
	},
	async load() {
		// load from local storage / indexdb
	}
};
