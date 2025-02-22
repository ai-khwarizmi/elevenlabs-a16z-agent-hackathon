declare module 'browserfs' {
	export interface FSModule {
		writeFile(path: string, data: string | Buffer, callback: (err?: Error) => void): void;
		readFile(path: string, encoding: string, callback: (err?: Error, data?: string) => void): void;
		readdir(path: string, callback: (err?: Error, files?: string[]) => void): void;
		stat(path: string, callback: (err?: Error, stats?: Stats) => void): void;
		mkdir(path: string, callback: (err?: Error) => void): void;
		unlink(path: string, callback: (err?: Error) => void): void;
		exists(path: string, callback: (exists: boolean) => void): void;
	}

	export interface Stats {
		isFile(): boolean;
		isDirectory(): boolean;
		size: number;
		mtime: Date;
		atime: Date;
		ctime: Date;
		birthtime: Date;
	}

	export interface BrowserFS {
		configure(config: { fs: string; options: any }, callback: (e?: Error) => void): void;
		BFSRequire(module: string): FSModule;
	}

	const BrowserFS: BrowserFS;
	export default BrowserFS;
}
