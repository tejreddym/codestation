// @vitest-environment jsdom
import {cleanup,fireEvent,render,screen,waitFor} from '@testing-library/react';
import {afterEach,beforeEach,describe,it,expect,vi} from 'vitest';
import {WorkbenchProvider,useWorkbench} from './WorkbenchProvider';
import {FavoriteButton} from './PersonalTools';
import ToolLauncher from './ToolLauncher';
import TextWorkspace from './TextWorkspace';
import WebStation from './WebStation';
import FeedbackForm from './FeedbackForm';
const {push}=vi.hoisted(()=>({push:vi.fn()}));
vi.mock('./useSafeNavigation',()=>({useSafePathname:()=>'/workbench',useSafeRouter:()=>({push})}));
beforeEach(()=>{localStorage.clear();push.mockClear();HTMLDialogElement.prototype.showModal=function(){this.open=true;};HTMLDialogElement.prototype.close=function(){this.open=false;};});
afterEach(()=>{cleanup();vi.restoreAllMocks();});
function Queue({slug,text}:{slug:string;text:string}){const {queueInput}=useWorkbench();return <button onClick={()=>queueInput(slug,text)}>Hand off</button>;}
describe('Workbench interactions',()=>{
 it('persists favorites as IDs and toggles them off',async()=>{render(<WorkbenchProvider><FavoriteButton slug="json-formatter"/></WorkbenchProvider>);fireEvent.click(screen.getByRole('button',{name:/Add JSON Formatter/}));await waitFor(()=>expect(localStorage.getItem('code-station-workbench-v1')).toContain('json-formatter'));fireEvent.click(screen.getByRole('button',{name:/Remove JSON Formatter/}));await waitFor(()=>expect(JSON.parse(localStorage.getItem('code-station-workbench-v1')!).favorites).toEqual([]));});
 it('hands text to the real text field without processing or storing it',async()=>{render(<WorkbenchProvider><Queue slug="text-counter" text="memory only secret"/><TextWorkspace toolId="text-counter"/></WorkbenchProvider>);fireEvent.click(screen.getByText('Hand off'));await waitFor(()=>expect((screen.getByRole('textbox') as HTMLTextAreaElement).value).toBe('memory only secret'));expect(localStorage.getItem('code-station-workbench-v1')).not.toContain('memory only secret');expect(screen.queryByText('Result ready.')).toBeNull();});
 it('hands URLs to the URL field without making requests',async()=>{render(<WorkbenchProvider><Queue slug="url-parser" text="https://example.com/test"/><WebStation toolId="url-parser"/></WorkbenchProvider>);fireEvent.click(screen.getByText('Hand off'));await waitFor(()=>expect((screen.getByLabelText('URL') as HTMLInputElement).value).toBe('https://example.com/test'));});
 it('opens keyboard search and routes Enter to a canonical tool',()=>{render(<WorkbenchProvider><ToolLauncher/></WorkbenchProvider>);fireEvent.keyDown(window,{key:'k',ctrlKey:true});const input=screen.getByRole('searchbox');fireEvent.change(input,{target:{value:'json formatter'}});fireEvent.keyDown(input,{key:'Enter'});expect(push).toHaveBeenCalledWith('/tools/json-formatter');});
 it('offers a manual clipboard fallback and auto-opens only a confident match',async()=>{Object.defineProperty(navigator,'clipboard',{configurable:true,value:{readText:vi.fn().mockRejectedValue(Error('Denied'))}});render(<WorkbenchProvider><ToolLauncher/></WorkbenchProvider>);fireEvent.click(screen.getByRole('button',{name:'Smart Detection: inspect clipboard'}));await screen.findByText(/Clipboard access was not available/);fireEvent.change(screen.getByLabelText('Or paste text here'),{target:{value:'{"a":1}'}});fireEvent.click(screen.getByText('Detect pasted text'));expect(push).not.toHaveBeenCalled();expect(screen.getAllByText('Open & paste →')).toHaveLength(3);fireEvent.change(screen.getByLabelText('Or paste text here'),{target:{value:'#D9F975'}});fireEvent.click(screen.getByText('Detect pasted text'));expect(push).toHaveBeenCalledWith('/tools/color-converter');});
 it('opens a correctly encoded owner-approved email draft, never submits',()=>{render(<FeedbackForm/>);fireEvent.change(screen.getByLabelText('Details'),{target:{value:'A & B\nUnexpected result'}});const href=screen.getByRole('link',{name:'Open email draft'}).getAttribute('href')!;expect(href).toContain('mailto:twnspace2@gmail.com?');expect(href).toContain('A%20%26%20B%0AUnexpected%20result');});
});
