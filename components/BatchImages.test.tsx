// @vitest-environment jsdom
import {act,cleanup,fireEvent,render,screen,waitFor} from '@testing-library/react';
import {afterEach,beforeEach,it,expect,vi} from 'vitest';
import BatchImages from './BatchImages';
const {runImage}=vi.hoisted(()=>({runImage:vi.fn()}));
vi.mock('@/lib/tools/image/engine',()=>({runImage}));
afterEach(cleanup);beforeEach(()=>{runImage.mockReset();});
it('discards an in-flight native conversion after cancellation',async()=>{let finish!:(value:unknown)=>void;runImage.mockImplementation(()=>new Promise(resolve=>finish=resolve));render(<BatchImages/>);fireEvent.change(screen.getByLabelText('PNG files'),{target:{files:[new File(['fixture'],'one.png',{type:'image/png'})]}});fireEvent.click(screen.getByText('Convert batch'));await waitFor(()=>expect(runImage).toHaveBeenCalledTimes(1));fireEvent.click(screen.getByText('Cancel batch'));await act(async()=>finish({blob:new Blob(['output']),warnings:[]}));expect(screen.queryByText('Download 01-one.webp')).toBeNull();expect(screen.getByRole('status').textContent).toContain('Cancelled');});
it('continues after a per-file error and invalidates output when settings change',async()=>{runImage.mockRejectedValueOnce(Error('Bad PNG')).mockResolvedValue({blob:new Blob(['output']),warnings:[]});render(<BatchImages/>);fireEvent.change(screen.getByLabelText('PNG files'),{target:{files:[new File(['x'],'bad.png'),new File(['y'],'good.png')]}});fireEvent.click(screen.getByText('Convert batch'));await screen.findByText('Download 02-good.webp');expect(screen.getByText('Bad PNG')).toBeTruthy();fireEvent.change(screen.getByLabelText('Output format'),{target:{value:'jpg'}});expect(screen.queryByText('Download 02-good.webp')).toBeNull();});
