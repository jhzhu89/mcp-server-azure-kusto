import { readFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export interface DescriptionLoader {
  load(toolName: string): string;
}

class FileDescriptionLoader implements DescriptionLoader {
  constructor(private basePath: string) {}

  load(toolName: string): string {
    const filePath = join(this.basePath, `${toolName}.md`);
    return readFileSync(filePath, "utf-8").trim();
  }
}

function createDescriptionLoader(): DescriptionLoader {
  return new FileDescriptionLoader(join(__dirname, "descriptions"));
}

const descriptionLoader = createDescriptionLoader();

export { descriptionLoader };
