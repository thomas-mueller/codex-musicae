import * as Comlink from 'comlink';

import { createPdfWriterApi } from '../pdflib/pdf-writer-api';

Comlink.expose(createPdfWriterApi());
