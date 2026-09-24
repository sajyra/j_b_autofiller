import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import '../index.css';

const rootElement = document.getElementById('root');
if (rootElement) {
  ReactDOM.createRoot(rootElement).render(
    <React.StrictMode>
      <App />
    </React.StrictMode>
  );
}

// Dev Bridge in Options Dashboard for live inspection and testing
if (typeof window !== 'undefined' && typeof chrome !== 'undefined' && chrome.tabs) {
  let isPolling = false;
  const pollDevServer = async () => {
    if (isPolling) return;
    isPolling = true;
    try {
      const res = await fetch('http://127.0.0.1:8765/poll', { signal: AbortSignal.timeout(3000) });
      if (res.ok) {
        const cmd = await res.json();
        if (cmd && cmd.type) {
          console.log('[Dev Bridge Options] Received command:', cmd);
          if (cmd.type === 'RELOAD') {
            chrome.runtime.reload();
          } else if (cmd.type === 'GET_PROFILE') {
            chrome.storage.local.get(null, (data) => {
              fetch('http://127.0.0.1:8765/log', {
                method: 'POST',
                body: JSON.stringify(data),
              }).catch(() => {});
            });
          } else if (cmd.type === 'AUTOFILL_WORKDAY') {
            chrome.tabs.query({ url: '*://*.myworkdayjobs.com/*' }, (tabs) => {
              const tab = tabs[0];
              if (!tab || !tab.id) {
                fetch('http://127.0.0.1:8765/log', {
                  method: 'POST',
                  body: JSON.stringify({ error: 'No Workday tab found' }),
                }).catch(() => {});
                return;
              }
              chrome.scripting.executeScript({
                target: { tabId: tab.id! },
                files: ['content.js'],
              }).then(() => {
                setTimeout(() => {
                  chrome.tabs.sendMessage(tab.id!, { action: 'AUTOFILL_V2' }, (res2) => {
                    fetch('http://127.0.0.1:8765/log', {
                      method: 'POST',
                      body: JSON.stringify({ event: 'AUTOFILL_DONE', res: res2, err: chrome.runtime.lastError?.message }),
                    }).catch(() => {});
                  });
                }, 300);
              }).catch((err) => {
                fetch('http://127.0.0.1:8765/log', {
                  method: 'POST',
                  body: JSON.stringify({ error: err.message }),
                }).catch(() => {});
              });
            });
          } else if (cmd.type === 'INSPECT_SELECTOR') {
            chrome.tabs.query({ url: '*://*.myworkdayjobs.com/*' }, (tabs) => {
              const tab = tabs[0];
              if (!tab || !tab.id) {
                fetch('http://127.0.0.1:8765/log', {
                  method: 'POST',
                  body: JSON.stringify({ error: 'No Workday tab found' }),
                }).catch(() => {});
                return;
              }
              chrome.scripting.executeScript({
                target: { tabId: tab.id },
                func: (sel: string) => {
                  try {
                    const elements = Array.from(document.querySelectorAll(sel));
                    return {
                      count: elements.length,
                      items: elements.slice(0, 5).map((el) => ({
                        tagName: el.tagName,
                        id: el.id,
                        className: el.className,
                        outerHTML: el.outerHTML.slice(0, 1000),
                        parentOuterHTML: el.parentElement ? el.parentElement.outerHTML.slice(0, 1000) : null,
                      })),
                    };
                  } catch (e: any) {
                    return { error: e?.message || String(e) };
                  }
                },
                args: [cmd.selector],
              }).then((results) => {
                fetch('http://127.0.0.1:8765/log', {
                  method: 'POST',
                  body: JSON.stringify(results?.[0]?.result || {}),
                }).catch(() => {});
              }).catch((err) => {
                fetch('http://127.0.0.1:8765/log', {
                  method: 'POST',
                  body: JSON.stringify({ error: err.message }),
                }).catch(() => {});
              });
            });
          } else if (cmd.type === 'TEST_ACTION') {
            chrome.tabs.query({ url: '*://*.myworkdayjobs.com/*' }, (tabs) => {
              const tab = tabs[0];
              if (!tab || !tab.id) return;
              chrome.scripting.executeScript({
                target: { tabId: tab.id },
                world: 'MAIN',
                func: async (action: string) => {
                  try {
                    if (action === 'test_source_enter') {
                      const inp = document.getElementById('source--source') as HTMLInputElement;
                      if (!inp) return { error: 'source--source not found' };
                      inp.focus();
                      // Workday React input value setting
                      const proto = window.HTMLInputElement.prototype;
                      const setter = Object.getOwnPropertyDescriptor(proto, 'value')?.set;
                      if (setter) setter.call(inp, 'LinkedIn');
                      else inp.value = 'LinkedIn';
                      inp.dispatchEvent(new Event('input', { bubbles: true }));
                      inp.dispatchEvent(new Event('change', { bubbles: true }));
                      inp.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', code: 'Enter', keyCode: 13, which: 13, bubbles: true }));
                      inp.dispatchEvent(new KeyboardEvent('keyup', { key: 'Enter', code: 'Enter', keyCode: 13, which: 13, bubbles: true }));
                      
                      await new Promise((r) => setTimeout(r, 600));
                      const popups = Array.from(document.querySelectorAll('[role="listbox"], [role="option"], [data-automation-id*="promptOption" i], [data-automation-id*="menuItem" i], ul li, [data-automation-label]')).map((el) => ({
                        tag: el.tagName,
                        role: el.getAttribute('role'),
                        autoId: el.getAttribute('data-automation-id'),
                        label: el.getAttribute('data-automation-label'),
                        text: el.textContent?.trim().slice(0, 50),
                      }));
                      return { success: true, popups: popups.slice(0, 15) };
                    }
                    if (action === 'test_previous_worker_no') {
                      const noRadio = document.querySelector('input[name="candidateIsPreviousWorker"][value="false"]') as HTMLInputElement;
                      if (!noRadio) return { error: 'noRadio not found' };
                      const label = document.querySelector(`label[for="${noRadio.id}"]`) as HTMLElement;
                      if (label) label.click();
                      else noRadio.click();
                      return { success: true, checked: noRadio.checked };
                    }
                    if (action === 'test_state_and_phone') {
                      const stateBtn = document.getElementById('address--countryRegion') as HTMLElement;
                      const phoneBtn = document.getElementById('phoneNumber--phoneType') as HTMLElement;
                      
                      const fireClick = (elem: HTMLElement) => {
                        elem.focus();
                        ['pointerdown', 'mousedown', 'pointerup', 'mouseup', 'click'].forEach((evtName) => {
                          const Evt = evtName.startsWith('pointer') && typeof PointerEvent !== 'undefined' ? PointerEvent : MouseEvent;
                          elem.dispatchEvent(new Evt(evtName, { bubbles: true, cancelable: true, view: window }));
                        });
                      };

                      let stateSuccess = false;
                      if (stateBtn) {
                        fireClick(stateBtn);
                        await new Promise((r) => setTimeout(r, 400));
                        const options = Array.from(document.querySelectorAll<HTMLElement>('[role="option"], li, [data-automation-id="menuItem"], [data-automation-id="select-item"]')).filter(
                          (el) => (el.textContent || '').trim().toLowerCase() === 'texas' || (el.textContent || '').trim().toLowerCase().startsWith('texas')
                        );
                        if (options.length > 0) {
                          fireClick(options[0]);
                          stateSuccess = true;
                        }
                      }

                      await new Promise((r) => setTimeout(r, 300));

                      let phoneSuccess = false;
                      if (phoneBtn) {
                        fireClick(phoneBtn);
                        await new Promise((r) => setTimeout(r, 400));
                        const options = Array.from(document.querySelectorAll<HTMLElement>('[role="option"], li, [data-automation-id="menuItem"], [data-automation-id="select-item"]')).filter(
                          (el) => (el.textContent || '').trim().toLowerCase() === 'mobile' || (el.textContent || '').trim().toLowerCase().includes('mobile')
                        );
                        if (options.length > 0) {
                          fireClick(options[0]);
                          phoneSuccess = true;
                        }
                      }

                      return {
                        stateSuccess,
                        stateText: stateBtn?.textContent?.trim(),
                        stateValue: (stateBtn as any)?.value,
                        phoneSuccess,
                        phoneText: phoneBtn?.textContent?.trim(),
                        phoneValue: (phoneBtn as any)?.value,
                      };
                    }
                    if (action === 'test_debug_radio') {
                      const radioInputs = Array.from(document.querySelectorAll<HTMLInputElement>('input[type="radio"]'));
                      const grouped = radioInputs.map((r) => {
                        const forLabel = r.id ? document.querySelector(`label[for="${r.id}"]`)?.textContent?.trim() : null;
                        const closestLabel = r.closest('label')?.textContent?.trim();
                        const parentLabel = r.parentElement?.parentElement?.querySelector('label')?.textContent?.trim();
                        const fieldset = r.closest('fieldset');
                        const legend = fieldset?.querySelector('legend, label')?.textContent?.trim();
                        return {
                          id: r.id,
                          name: r.name,
                          value: r.value,
                          checked: r.checked,
                          forLabel,
                          closestLabel,
                          parentLabel,
                          legend,
                        };
                      });
                      return { success: true, grouped };
                    }
                    if (action === 'test_select_source') {
                      const inp = document.getElementById('source--source') as HTMLInputElement;
                      if (!inp) return { error: 'source--source not found' };
                      inp.focus();
                      const proto = window.HTMLInputElement.prototype;
                      const setter = Object.getOwnPropertyDescriptor(proto, 'value')?.set;
                      if (setter) setter.call(inp, 'LinkedIn');
                      else inp.value = 'LinkedIn';
                      inp.dispatchEvent(new Event('input', { bubbles: true }));
                      inp.dispatchEvent(new Event('change', { bubbles: true }));
                      inp.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', code: 'Enter', keyCode: 13, which: 13, bubbles: true }));
                      inp.dispatchEvent(new KeyboardEvent('keyup', { key: 'Enter', code: 'Enter', keyCode: 13, which: 13, bubbles: true }));
                      
                      await new Promise((r) => setTimeout(r, 600));
                      const menuItems = Array.from(document.querySelectorAll<HTMLElement>('[data-automation-id="menuItem"]')).filter(
                        (el) => (el.getAttribute('aria-label') || el.textContent || '').toLowerCase().includes('linkedin')
                      );
                      if (menuItems.length === 0) return { error: 'no linkedin menuItem found' };
                      const mi = menuItems[0];
                      const radio = mi.querySelector<HTMLElement>('input[type="radio"], [data-automation-id="radioBtn"]');
                      const leaf = mi.querySelector<HTMLElement>('[data-automation-id="promptLeafNode"]') || mi;
                      
                      const target = radio || leaf;
                      target.scrollIntoView();
                      
                      const fireClick = (elem: HTMLElement) => {
                        ['pointerdown', 'mousedown', 'pointerup', 'mouseup', 'click'].forEach((evtName) => {
                          const Evt = evtName.startsWith('pointer') && typeof PointerEvent !== 'undefined' ? PointerEvent : MouseEvent;
                          elem.dispatchEvent(new Evt(evtName, { bubbles: true, cancelable: true, view: window }));
                        });
                      };

                      fireClick(target);
                      if (radio && target !== radio) fireClick(radio);
                      fireClick(mi);

                      await new Promise((r) => setTimeout(r, 500));
                      const container = inp.closest('[data-automation-id*="formField" i]') || document.body;
                      const selectedPills = Array.from(container.querySelectorAll('[data-automation-id="selectedItem"], [id*="pill-"], [data-automation-id="promptSelectionLabel"], [data-automation-id="promptOption"]')).map((el) => el.textContent?.trim());
                      return {
                        success: true,
                        selectedPills,
                        ariaInstruction: container.querySelector('[data-automation-id="promptAriaInstruction"]')?.textContent?.trim() || null,
                      };
                    }
                    if (action === 'click_next') {
                      const btn = document.querySelector<HTMLElement>('[data-automation-id="pageFooterNextButton"]');
                      if (!btn) return { error: 'pageFooterNextButton not found' };
                      btn.focus();
                      ['pointerdown', 'mousedown', 'pointerup', 'mouseup', 'click'].forEach((evtName) => {
                        const Evt = evtName.startsWith('pointer') && typeof PointerEvent !== 'undefined' ? PointerEvent : MouseEvent;
                        btn.dispatchEvent(new Evt(evtName, { bubbles: true, cancelable: true, view: window }));
                      });
                      return { success: true };
                    }
                    if (action === 'dump_questions_page') {
                      const fieldContainers = Array.from(document.querySelectorAll<HTMLElement>(
                        '[data-automation-id*="formField" i], fieldset, [data-automation-id*="question" i], div.css-12zup1l, div[id*="primaryQuestionnaire"]'
                      ));

                      // Find all question labels and their associated triggers
                      const items: any[] = [];
                      const allButtons = Array.from(document.querySelectorAll<HTMLElement>('button[id*="primaryQuestionnaire"], input[id*="primaryQuestionnaire"], textarea[id*="primaryQuestionnaire"]'));
                      for (const el of allButtons) {
                        const container = el.closest('[data-automation-id*="formField" i]') || el.parentElement?.parentElement?.parentElement || el.parentElement;
                        const label = container?.querySelector('label, legend, h2, h3, h4, p')?.textContent?.trim() ||
                                      document.querySelector(`label[for="${el.id}"]`)?.textContent?.trim() ||
                                      el.getAttribute('aria-label') || '';
                        items.push({
                          id: el.id,
                          tag: el.tagName,
                          type: (el as any).type,
                          currentText: el.textContent?.trim(),
                          label,
                          containerSnippet: container?.textContent?.trim().slice(0, 300),
                        });
                      }
                      return { success: true, items };
                    }
                    if (action === 'test_answer_questions') {
                      const fireClick = (elem: HTMLElement) => {
                        elem.focus();
                        ['pointerdown', 'mousedown', 'pointerup', 'mouseup', 'click'].forEach((evtName) => {
                          const Evt = evtName.startsWith('pointer') && typeof PointerEvent !== 'undefined' ? PointerEvent : MouseEvent;
                          elem.dispatchEvent(new Evt(evtName, { bubbles: true, cancelable: true, view: window }));
                        });
                      };

                      const setVal = (input: HTMLElement, val: string) => {
                        input.focus();
                        const proto = (input instanceof HTMLTextAreaElement ? window.HTMLTextAreaElement : window.HTMLInputElement).prototype;
                        const setter = Object.getOwnPropertyDescriptor(proto, 'value')?.set;
                        if (setter) setter.call(input, val);
                        else (input as any).value = val;
                        input.dispatchEvent(new Event('input', { bubbles: true }));
                        input.dispatchEvent(new Event('change', { bubbles: true }));
                      };

                      const results: any[] = [];
                      const allButtons = Array.from(document.querySelectorAll<HTMLElement>('button[id*="primaryQuestionnaire"]'));
                      for (const btn of allButtons) {
                        const container = btn.closest('[data-automation-id*="formField" i]') || btn.parentElement?.parentElement?.parentElement || btn.parentElement;
                        const label = container?.querySelector('label, legend, h2, h3, h4, p')?.textContent?.trim() ||
                                      document.querySelector(`label[for="${btn.id}"]`)?.textContent?.trim() || '';

                        const labelLower = label.toLowerCase();
                        let targetAnswer = 'no';
                        if (labelLower.includes('authorized to work') || labelLower.includes('18 years of age')) {
                          targetAnswer = 'yes';
                        }

                        fireClick(btn);
                        await new Promise((r) => setTimeout(r, 300));
                        const options = Array.from(document.querySelectorAll<HTMLElement>('[role="option"], li, [data-automation-id="menuItem"]'));
                        const matchOpt = options.find((opt) => (opt.textContent || '').trim().toLowerCase() === targetAnswer);
                        if (matchOpt) {
                          fireClick(matchOpt);
                          results.push({ id: btn.id, label: label.slice(0, 40), targetAnswer, success: true });
                        } else {
                          results.push({ id: btn.id, label: label.slice(0, 40), targetAnswer, success: false, optionsFound: options.map((o) => o.textContent?.trim()) });
                        }
                        await new Promise((r) => setTimeout(r, 200));
                      }

                      // Fill salary & start date
                      const salaryInp = document.getElementById('primaryQuestionnaire--9e192fd438ad1000c7e58d9476930000') as HTMLInputElement;
                      if (salaryInp) {
                        setVal(salaryInp, 'Negotiable');
                      }

                      const startInp = document.getElementById('primaryQuestionnaire--9e192fd438ad1000c7e58d9476930001') as HTMLTextAreaElement;
                      if (startInp) {
                        setVal(startInp, '2 weeks');
                      }

                      return { results, salary: salaryInp?.value, startDate: startInp?.value };
                    }
                    if (action === 'test_fix_q4_and_salary') {
                      const fireClick = (elem: HTMLElement) => {
                        elem.focus();
                        ['pointerdown', 'mousedown', 'pointerup', 'mouseup', 'click'].forEach((evtName) => {
                          const Evt = evtName.startsWith('pointer') && typeof PointerEvent !== 'undefined' ? PointerEvent : MouseEvent;
                          elem.dispatchEvent(new Evt(evtName, { bubbles: true, cancelable: true, view: window }));
                        });
                      };

                      const setVal = (input: HTMLElement, val: string) => {
                        input.focus();
                        const proto = (input instanceof HTMLTextAreaElement ? window.HTMLTextAreaElement : window.HTMLInputElement).prototype;
                        const setter = Object.getOwnPropertyDescriptor(proto, 'value')?.set;
                        if (setter) setter.call(input, val);
                        else (input as any).value = val;
                        input.dispatchEvent(new Event('input', { bubbles: true }));
                        input.dispatchEvent(new Event('change', { bubbles: true }));
                        input.dispatchEvent(new FocusEvent('blur', { bubbles: true }));
                      };

                      const q4Btn = document.getElementById('primaryQuestionnaire--9e192fd438ad1000c7e58bc6eb650005') as HTMLElement;
                      let q4Success = false;
                      let debugInfo: any = {};
                      if (q4Btn) {
                        const ariaControls = q4Btn.getAttribute('aria-controls');
                        const ariaOwns = q4Btn.getAttribute('aria-owns');
                        const ariaExpanded = q4Btn.getAttribute('aria-expanded');
                        debugInfo.btnAttrs = { ariaControls, ariaOwns, ariaExpanded, id: q4Btn.id };

                        fireClick(q4Btn);
                        await new Promise((r) => setTimeout(r, 400));

                        const listboxes = Array.from(document.querySelectorAll<HTMLElement>('[role="listbox"], [id*="listbox"], ul[role="listbox"]'));
                        const activeLb = listboxes[listboxes.length - 1];
                        if (activeLb) {
                          const options = Array.from(activeLb.querySelectorAll<HTMLElement>('[role="option"], li'));
                          const noOpt = options.find((opt) => (opt.textContent || '').trim().toLowerCase() === 'no');
                          if (noOpt) {
                            fireClick(noOpt);
                            q4Success = true;
                          }
                        }
                        await new Promise((r) => setTimeout(r, 400));
                        debugInfo.q4TextAfter = q4Btn.textContent?.trim();
                        debugInfo.q4Success = q4Success;
                      }

                      return debugInfo;
                    }
                    if (action === 'test_step5_disclosures') {
                      const fireClick = (elem: HTMLElement) => {
                        elem.focus();
                        ['pointerdown', 'mousedown', 'pointerup', 'mouseup', 'click'].forEach((evtName) => {
                          const Evt = evtName.startsWith('pointer') && typeof PointerEvent !== 'undefined' ? PointerEvent : MouseEvent;
                          elem.dispatchEvent(new Evt(evtName, { bubbles: true, cancelable: true, view: window }));
                        });
                      };

                      const results: any = {};
                      const dropdownIds = [
                        'personalInfoUS--gender',
                        'personalInfoUS--ethnicity',
                        'personalInfoUS--hispanicOrLatino',
                        'personalInfoUS--veteranStatus',
                      ];

                      for (const id of dropdownIds) {
                        const btn = document.getElementById(id);
                        if (!btn) {
                          results[id] = { error: 'not found' };
                          continue;
                        }
                        fireClick(btn);
                        await new Promise((r) => setTimeout(r, 400));
                        const ariaControls = btn.getAttribute('aria-controls');
                        let listbox: HTMLElement | null = ariaControls ? document.getElementById(ariaControls) : null;
                        if (!listbox) {
                          const listboxes = Array.from(document.querySelectorAll<HTMLElement>('[role="listbox"], ul[role="listbox"]'));
                          listbox = listboxes[listboxes.length - 1] || null;
                        }
                        const options = listbox
                          ? Array.from(listbox.querySelectorAll<HTMLElement>('[role="option"], li')).map((o) => o.textContent?.trim())
                          : [];
                        results[id] = {
                          ariaControls,
                          options,
                        };
                        fireClick(btn);
                        await new Promise((r) => setTimeout(r, 200));
                      }

                      const termsCheckbox = document.getElementById('termsAndConditions--acceptTermsAndAgreements') as HTMLInputElement;
                      results.termsFound = !!termsCheckbox;
                      if (termsCheckbox) {
                        termsCheckbox.click();
                        results.termsChecked = termsCheckbox.checked;
                      }

                      return results;
                    }

                    if (action === 'fill_step5_now') {
                      const fireClick = (elem: HTMLElement) => {
                        elem.focus();
                        ['pointerdown', 'mousedown', 'pointerup', 'mouseup', 'click'].forEach((evtName) => {
                          const Evt = evtName.startsWith('pointer') && typeof PointerEvent !== 'undefined' ? PointerEvent : MouseEvent;
                          elem.dispatchEvent(new Evt(evtName, { bubbles: true, cancelable: true, view: window }));
                        });
                      };

                      const results: any = {};
                      const dropdownTargets: Record<string, RegExp> = {
                        'personalInfoUS--gender': /^male$/i,
                        'personalInfoUS--ethnicity': /asian\s*\(not hispanic/i,
                        'personalInfoUS--hispanicOrLatino': /^no$/i,
                        'personalInfoUS--veteranStatus': /not a veteran/i,
                      };

                      for (const [id, pattern] of Object.entries(dropdownTargets)) {
                        const btn = document.getElementById(id);
                        if (!btn) {
                          results[id] = { error: 'button not found' };
                          continue;
                        }

                        fireClick(btn);
                        await new Promise((r) => setTimeout(r, 400));
                        const ariaControls = btn.getAttribute('aria-controls');
                        let listbox: HTMLElement | null = ariaControls ? document.getElementById(ariaControls) : null;
                        if (!listbox) {
                          const listboxes = Array.from(document.querySelectorAll<HTMLElement>('[role="listbox"], ul[role="listbox"]'));
                          listbox = listboxes[listboxes.length - 1] || null;
                        }

                        const options = listbox
                          ? Array.from(listbox.querySelectorAll<HTMLElement>('[role="option"], li'))
                          : [];

                        const matchOpt = options.find((opt) => pattern.test((opt.textContent || '').trim()));
                        if (matchOpt) {
                          fireClick(matchOpt);
                          await new Promise((r) => setTimeout(r, 300));
                          results[id] = {
                            success: true,
                            selectedText: btn.textContent?.trim(),
                          };
                        } else {
                          results[id] = {
                            success: false,
                            optionsFound: options.map((o) => o.textContent?.trim()),
                          };
                          fireClick(btn);
                        }
                        await new Promise((r) => setTimeout(r, 200));
                      }

                      const termsCheckbox = document.getElementById('termsAndConditions--acceptTermsAndAgreements') as HTMLInputElement;
                      if (termsCheckbox) {
                        if (!termsCheckbox.checked) {
                          termsCheckbox.click();
                        }
                        results.termsAgreed = termsCheckbox.checked;
                      } else {
                        results.termsAgreed = 'not found';
                      }

                      return results;
                    }

                    if (action === 'fill_step6_now') {
                      const fireClick = (elem: HTMLElement) => {
                        elem.focus();
                        ['pointerdown', 'mousedown', 'pointerup', 'mouseup', 'click'].forEach((evtName) => {
                          const Evt = evtName.startsWith('pointer') && typeof PointerEvent !== 'undefined' ? PointerEvent : MouseEvent;
                          elem.dispatchEvent(new Evt(evtName, { bubbles: true, cancelable: true, view: window }));
                        });
                      };

                      const setVal = (input: HTMLElement, val: string) => {
                        input.focus();
                        const proto = (input instanceof HTMLTextAreaElement ? window.HTMLTextAreaElement : window.HTMLInputElement).prototype;
                        const setter = Object.getOwnPropertyDescriptor(proto, 'value')?.set;
                        if (setter) setter.call(input, val);
                        else (input as any).value = val;
                        input.dispatchEvent(new Event('input', { bubbles: true }));
                        input.dispatchEvent(new Event('change', { bubbles: true }));
                        input.dispatchEvent(new FocusEvent('blur', { bubbles: true }));
                      };

                      const results: any = {};

                      // 1. Name
                      const nameInp = document.getElementById('selfIdentifiedDisabilityData--name') as HTMLInputElement;
                      if (nameInp) {
                        setVal(nameInp, 'Sanjay Rajjan');
                        results.name = nameInp.value;
                      }

                      // 2. Date
                      const d = new Date();
                      const mm = String(d.getMonth() + 1).padStart(2, '0');
                      const dd = String(d.getDate()).padStart(2, '0');
                      const yyyy = String(d.getFullYear());

                      const mInp = document.getElementById('selfIdentifiedDisabilityData--dateSignedOn-dateSectionMonth-input') as HTMLInputElement;
                      const dInp = document.getElementById('selfIdentifiedDisabilityData--dateSignedOn-dateSectionDay-input') as HTMLInputElement;
                      const yInp = document.getElementById('selfIdentifiedDisabilityData--dateSignedOn-dateSectionYear-input') as HTMLInputElement;

                      if (mInp && dInp && yInp) {
                        setVal(mInp, mm);
                        setVal(dInp, dd);
                        setVal(yInp, yyyy);
                        results.date = `${mInp.value}/${dInp.value}/${yInp.value}`;
                      }

                      // 3. Disability Checkbox: No, I do not have a disability
                      const noCb = document.getElementById('64cbff5f364f10000aeec521b4ec0000-disabilityStatus') as HTMLInputElement;
                      if (noCb) {
                        if (!noCb.checked) {
                          noCb.click();
                        }
                        results.disabilityChecked = noCb.checked;
                      }

                      return results;
                    }
                    if (action === 'diagnose_and_fix_step6') {
                      const nameInp = document.getElementById('selfIdentifiedDisabilityData--name') as HTMLInputElement;
                      if (!nameInp) return { error: 'nameInp not found' };

                      const reactKeys = Object.keys(nameInp).filter((k) => k.startsWith('__react'));
                      const propsKey = reactKeys.find((k) => k.startsWith('__reactProps'));
                      const fiberKey = reactKeys.find((k) => k.startsWith('__reactFiber'));

                      const props = propsKey ? (nameInp as any)[propsKey] : null;
                      const fiber = fiberKey ? (nameInp as any)[fiberKey] : null;

                      const hasOnChange = typeof props?.onChange === 'function';
                      const hasOnInput = typeof props?.onInput === 'function';
                      const hasOnBlur = typeof props?.onBlur === 'function';

                      const prevVal = nameInp.value;
                      const prevAriaInvalid = nameInp.getAttribute('aria-invalid');

                      // 1. Prototype setter
                      const proto = window.HTMLInputElement.prototype;
                      const setter = Object.getOwnPropertyDescriptor(proto, 'value')?.set;
                      if (setter) setter.call(nameInp, 'Sanjay Rajjan');
                      else nameInp.value = 'Sanjay Rajjan';

                      // 2. Clear tracker
                      const tracker = (nameInp as any)._valueTracker;
                      if (tracker) tracker.setValue('');

                      // 3. Dispatch standard events
                      nameInp.dispatchEvent(new Event('input', { bubbles: true }));
                      nameInp.dispatchEvent(new Event('change', { bubbles: true }));

                      // 4. Call React onChange/onInput directly if present
                      if (hasOnChange) {
                        try {
                          props.onChange({
                            target: nameInp,
                            currentTarget: nameInp,
                            preventDefault: () => {},
                            stopPropagation: () => {},
                            persist: () => {},
                            nativeEvent: new Event('change'),
                          });
                        } catch (e: any) {
                          console.error(e);
                        }
                      }
                      if (hasOnBlur) {
                        try {
                          props.onBlur({
                            target: nameInp,
                            currentTarget: nameInp,
                            preventDefault: () => {},
                            stopPropagation: () => {},
                            persist: () => {},
                            nativeEvent: new FocusEvent('blur'),
                          });
                        } catch (e: any) {}
                      }

                      await new Promise((r) => setTimeout(r, 200));

                      return {
                        prevVal,
                        newVal: nameInp.value,
                        prevAriaInvalid,
                        newAriaInvalid: nameInp.getAttribute('aria-invalid'),
                        reactKeys,
                        propKeys: Object.keys(props || {}),
                        hasOnChange,
                        hasOnInput,
                        hasOnBlur,
                      };
                    }
                    if (action === 'test_exec_command_typing') {
                      const typeIntoInput = (inp: HTMLInputElement, val: string) => {
                        inp.focus();
                        inp.select();
                        document.execCommand('selectAll', false);
                        document.execCommand('delete', false);
                        document.execCommand('insertText', false, val);
                        inp.dispatchEvent(new Event('input', { bubbles: true }));
                        inp.dispatchEvent(new Event('change', { bubbles: true }));
                        inp.dispatchEvent(new FocusEvent('blur', { bubbles: true }));
                      };

                      const results: any = {};

                      const nameInp = document.getElementById('selfIdentifiedDisabilityData--name') as HTMLInputElement;
                      if (nameInp) {
                        typeIntoInput(nameInp, 'Sanjay Rajjan');
                        results.name = nameInp.value;
                      }

                      const mInp = document.getElementById('selfIdentifiedDisabilityData--dateSignedOn-dateSectionMonth-input') as HTMLInputElement;
                      const dInp = document.getElementById('selfIdentifiedDisabilityData--dateSignedOn-dateSectionDay-input') as HTMLInputElement;
                      const yInp = document.getElementById('selfIdentifiedDisabilityData--dateSignedOn-dateSectionYear-input') as HTMLInputElement;

                      if (mInp && dInp && yInp) {
                        typeIntoInput(mInp, '09');
                        typeIntoInput(dInp, '21');
                        typeIntoInput(yInp, '2026');
                        results.date = `${mInp.value}/${dInp.value}/${yInp.value}`;
                      }

                      // Check disability checkbox
                      const noCb = document.getElementById('64cbff5f364f10000aeec521b4ec0000-disabilityStatus') as HTMLInputElement;
                      if (noCb && !noCb.checked) {
                        noCb.click();
                      }
                      results.disabilityChecked = noCb?.checked;

                      await new Promise((r) => setTimeout(r, 400));

                      const errorElements = Array.from(document.querySelectorAll('[data-automation-id="errorMessage"], [id*="error" i], [aria-invalid="true"]')).map((el) => ({
                        id: el.id,
                        text: el.textContent?.trim(),
                        ariaInvalid: el.getAttribute('aria-invalid'),
                        tag: el.tagName,
                      }));

                      results.errorElements = errorElements;
                      return results;
                    }
                    if (action === 'test_click_date_calendar') {
                      const fireClick = (elem: HTMLElement) => {
                        elem.focus();
                        ['pointerdown', 'mousedown', 'pointerup', 'mouseup', 'click'].forEach((evtName) => {
                          const Evt = evtName.startsWith('pointer') && typeof PointerEvent !== 'undefined' ? PointerEvent : MouseEvent;
                          elem.dispatchEvent(new Evt(evtName, { bubbles: true, cancelable: true, view: window }));
                        });
                      };

                      const calBtn = document.querySelector<HTMLElement>('[data-automation-id="dateIcon"]');
                      if (!calBtn) return { error: 'dateIcon not found' };

                      fireClick(calBtn);
                      await new Promise((r) => setTimeout(r, 400));

                      const popups = Array.from(document.querySelectorAll<HTMLElement>(
                        '[role="dialog"], [data-automation-id*="calendar" i], [data-automation-id*="date" i], [class*="calendar" i], [class*="popup" i], table, [role="grid"], [data-automation-id="datePicker"]'
                      )).map((el) => ({
                        tag: el.tagName,
                        role: el.getAttribute('role'),
                        autoId: el.getAttribute('data-automation-id'),
                        class: el.className,
                        text: el.textContent?.trim().slice(0, 200),
                      }));

                      return {
                        success: true,
                        popups: popups.slice(0, 10),
                      };
                    }
                    if (action === 'test_type_date_digits') {
                      const typeDigits = async (input: HTMLElement, digits: string) => {
                        input.focus();
                        for (const char of digits) {
                          const keyCode = char.charCodeAt(0);
                          input.dispatchEvent(new KeyboardEvent('keydown', { key: char, code: `Digit${char}`, keyCode, which: keyCode, bubbles: true, cancelable: true }));
                          input.dispatchEvent(new KeyboardEvent('keypress', { key: char, code: `Digit${char}`, keyCode, which: keyCode, bubbles: true, cancelable: true }));
                          input.dispatchEvent(new InputEvent('beforeinput', { data: char, inputType: 'insertText', bubbles: true, cancelable: true }));
                          input.dispatchEvent(new InputEvent('input', { data: char, inputType: 'insertText', bubbles: true, cancelable: true }));
                          input.dispatchEvent(new KeyboardEvent('keyup', { key: char, code: `Digit${char}`, keyCode, which: keyCode, bubbles: true, cancelable: true }));
                          await new Promise((r) => setTimeout(r, 60));
                        }
                        input.dispatchEvent(new FocusEvent('blur', { bubbles: true }));
                      };

                      const mInp = document.getElementById('selfIdentifiedDisabilityData--dateSignedOn-dateSectionMonth-input') as HTMLInputElement;
                      const dInp = document.getElementById('selfIdentifiedDisabilityData--dateSignedOn-dateSectionDay-input') as HTMLInputElement;
                      const yInp = document.getElementById('selfIdentifiedDisabilityData--dateSignedOn-dateSectionYear-input') as HTMLInputElement;

                      if (mInp) await typeDigits(mInp, '09');
                      if (dInp) await typeDigits(dInp, '21');
                      if (yInp) await typeDigits(yInp, '2026');

                      await new Promise((r) => setTimeout(r, 200));

                      const errorElements = Array.from(document.querySelectorAll('[data-automation-id="errorMessage"], [id*="error" i], [aria-invalid="true"]')).map((el) => ({
                        id: el.id,
                        text: el.textContent?.trim(),
                        ariaInvalid: el.getAttribute('aria-invalid'),
                        tag: el.tagName,
                      }));

                      return {
                        mVal: mInp?.value,
                        dVal: dInp?.value,
                        yVal: yInp?.value,
                        errorElements,
                      };
                    }
                    if (action === 'diagnose_date_fiber') {
                      const dateWrapper = document.getElementById('selfIdentifiedDisabilityData--dateSignedOn');
                      const mInp = document.getElementById('selfIdentifiedDisabilityData--dateSignedOn-dateSectionMonth-input');

                      const findReact = (el: HTMLElement | null) => {
                        if (!el) return null;
                        const key = Object.keys(el).find((k) => k.startsWith('__reactFiber') || k.startsWith('__reactInternalInstance'));
                        const propsKey = Object.keys(el).find((k) => k.startsWith('__reactProps'));
                        const props = propsKey ? (el as any)[propsKey] : null;
                        return {
                          elementId: el.id,
                          reactKey: key,
                          propsKey,
                          props: props ? Object.keys(props) : [],
                          propValues: props
                            ? {
                                value: typeof props.value === 'object' ? JSON.stringify(props.value) : props.value,
                                date: typeof props.date === 'object' ? JSON.stringify(props.date) : props.date,
                                onChange: typeof props.onChange,
                                onBlur: typeof props.onBlur,
                              }
                            : null,
                        };
                      };

                      return {
                        wrapper: findReact(dateWrapper),
                        wrapperParent: findReact(dateWrapper?.parentElement || null),
                        month: findReact(mInp),
                      };
                    }
                    if (action === 'commit_date_via_props') {
                      const mInp = document.getElementById('selfIdentifiedDisabilityData--dateSignedOn-dateSectionMonth-input') as any;
                      const dInp = document.getElementById('selfIdentifiedDisabilityData--dateSignedOn-dateSectionDay-input') as any;
                      const yInp = document.getElementById('selfIdentifiedDisabilityData--dateSignedOn-dateSectionYear-input') as any;
                      const wrapper = document.getElementById('selfIdentifiedDisabilityData--dateSignedOn') as any;

                      const mPropsKey = Object.keys(mInp || {}).find((k) => k.startsWith('__reactProps'))!;
                      const dPropsKey = Object.keys(dInp || {}).find((k) => k.startsWith('__reactProps'))!;
                      const yPropsKey = Object.keys(yInp || {}).find((k) => k.startsWith('__reactProps'))!;
                      const wrapPropsKey = Object.keys(wrapper || {}).find((k) => k.startsWith('__reactProps'))!;

                      const mProps = mInp?.[mPropsKey];
                      const dProps = dInp?.[dPropsKey];
                      const yProps = yInp?.[yPropsKey];
                      const wrapProps = wrapper?.[wrapPropsKey];

                      if (mProps?.onChange) {
                        mProps.onChange({ target: { value: '9' }, currentTarget: { value: '9' }, nativeEvent: new Event('change') });
                      }
                      if (dProps?.onChange) {
                        dProps.onChange({ target: { value: '21' }, currentTarget: { value: '21' }, nativeEvent: new Event('change') });
                      }
                      if (yProps?.onChange) {
                        yProps.onChange({ target: { value: '2026' }, currentTarget: { value: '2026' }, nativeEvent: new Event('change') });
                      }

                      await new Promise((r) => setTimeout(r, 100));

                      const syntheticBlurEvent = {
                        target: wrapper,
                        currentTarget: wrapper,
                        relatedTarget: document.body,
                        nativeEvent: {
                          target: wrapper,
                          currentTarget: wrapper,
                          relatedTarget: document.body,
                        },
                        preventDefault: () => {},
                        stopPropagation: () => {},
                        isDefaultPrevented: () => false,
                        isPropagationStopped: () => false,
                        persist: () => {},
                      };

                      if (wrapProps?.onBlur) {
                        try {
                          wrapProps.onBlur(syntheticBlurEvent);
                        } catch (e: any) {
                          console.warn('wrapProps onBlur error:', e);
                        }
                      }

                      wrapper.dispatchEvent(new FocusEvent('focusout', { bubbles: true, relatedTarget: document.body }));
                      wrapper.dispatchEvent(new FocusEvent('blur', { bubbles: false, relatedTarget: document.body }));

                      await new Promise((r) => setTimeout(r, 200));

                      const errorElements = Array.from(document.querySelectorAll('[data-automation-id="errorMessage"], [id*="error" i], [aria-invalid="true"]')).map((el) => ({
                        id: el.id,
                        text: el.textContent?.trim(),
                        ariaInvalid: el.getAttribute('aria-invalid'),
                        tag: el.tagName,
                      }));

                      return {
                        success: true,
                        errorElements,
                      };
                    }
                    if (action === 'click_add_education') {
                      const addBtns = Array.from(document.querySelectorAll<HTMLElement>('[data-automation-id="add-button"], button')).filter(
                        (b) => (b.textContent || '').trim().toLowerCase() === 'add'
                      );
                      // In the dump, the first 'Add' was Education!
                      if (addBtns.length === 0) return { error: 'no add buttons found' };
                      const eduAdd = addBtns.find((b) => {
                        const prev = b.closest('div')?.parentElement?.textContent || '';
                        return prev.toLowerCase().includes('education');
                      }) || addBtns[0];
                      eduAdd.click();
                      return { success: true, clickedText: eduAdd.textContent?.trim(), outer: eduAdd.outerHTML };
                    }
                    if (action === 'test_education_fields') {
                      const degreeBtn = (document.querySelector('button[name="degree"], [id*="--degree" i]') || document.getElementById('education-38--degree')) as HTMLElement;
                      if (!degreeBtn) return { error: 'degree button not found' };

                      const fireClick = (elem: HTMLElement) => {
                        elem.focus();
                        ['pointerdown', 'mousedown', 'pointerup', 'mouseup', 'click'].forEach((evtName) => {
                          const Evt = evtName.startsWith('pointer') && typeof PointerEvent !== 'undefined' ? PointerEvent : MouseEvent;
                          elem.dispatchEvent(new Evt(evtName, { bubbles: true, cancelable: true, view: window }));
                        });
                      };

                      fireClick(degreeBtn);
                      await new Promise((r) => setTimeout(r, 400));
                      const options = Array.from(document.querySelectorAll<HTMLElement>('[role="option"], li, [data-automation-id="menuItem"], [data-automation-id="select-item"]')).map((el) => ({
                        text: el.textContent?.trim(),
                        ariaLabel: el.getAttribute('aria-label'),
                        autoId: el.getAttribute('data-automation-id'),
                      }));

                      return { success: true, options: options.slice(0, 20) };
                    }
                    if (action === 'test_fos_search') {
                      const fosInp = (document.querySelector('input[id*="fieldOfStudy" i]') || document.getElementById('education-38--fieldOfStudy')) as HTMLInputElement;
                      if (!fosInp) return { error: 'fosInp not found' };
                      fosInp.focus();
                      const proto = window.HTMLInputElement.prototype;
                      const setter = Object.getOwnPropertyDescriptor(proto, 'value')?.set;
                      if (setter) setter.call(fosInp, 'Computer Science');
                      else fosInp.value = 'Computer Science';
                      fosInp.dispatchEvent(new Event('input', { bubbles: true }));
                      fosInp.dispatchEvent(new Event('change', { bubbles: true }));
                      fosInp.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', code: 'Enter', keyCode: 13, which: 13, bubbles: true }));
                      fosInp.dispatchEvent(new KeyboardEvent('keyup', { key: 'Enter', code: 'Enter', keyCode: 13, which: 13, bubbles: true }));
                      await new Promise((r) => setTimeout(r, 600));

                      const options = Array.from(document.querySelectorAll<HTMLElement>('[role="option"], [data-automation-id="menuItem"], [data-automation-id*="promptOption" i], li')).map((el) => ({
                        text: el.textContent?.trim(),
                        ariaLabel: el.getAttribute('aria-label'),
                        autoId: el.getAttribute('data-automation-id'),
                        autoLabel: el.getAttribute('data-automation-label'),
                      }));
                      return { success: true, count: options.length, options: options.slice(0, 15) };
                    }
                    if (action === 'test_fill_education_now') {
                      const setVal = (input: HTMLInputElement, val: string) => {
                        input.focus();
                        const proto = window.HTMLInputElement.prototype;
                        const setter = Object.getOwnPropertyDescriptor(proto, 'value')?.set;
                        if (setter) setter.call(input, val);
                        else input.value = val;
                        input.dispatchEvent(new Event('input', { bubbles: true }));
                        input.dispatchEvent(new Event('change', { bubbles: true }));
                      };

                      const school = (document.querySelector('input[name="schoolName"], [id*="schoolName" i]') || document.getElementById('education-38--schoolName')) as HTMLInputElement;
                      if (school) setVal(school, 'The University of Texas at Austin');

                      const gpa = (document.querySelector('input[name="gradeAverage"], [id*="gradeAverage" i]') || document.getElementById('education-38--gradeAverage')) as HTMLInputElement;
                      if (gpa) setVal(gpa, '3.58');

                      const from = (document.querySelector('input[id*="firstYearAttended" i]') || document.getElementById('education-38--firstYearAttended-dateSectionYear-input')) as HTMLInputElement;
                      if (from) setVal(from, '2024');

                      const to = (document.querySelector('input[id*="lastYearAttended" i]') || document.getElementById('education-38--lastYearAttended-dateSectionYear-input')) as HTMLInputElement;
                      if (to) setVal(to, '2028');

                      const degreeBtn = (document.querySelector('button[name="degree"], [id*="--degree" i]') || document.getElementById('education-38--degree')) as HTMLElement;
                      let degreeSelected = false;
                      if (degreeBtn) {
                        const fireClick = (elem: HTMLElement) => {
                          elem.focus();
                          ['pointerdown', 'mousedown', 'pointerup', 'mouseup', 'click'].forEach((evtName) => {
                            const Evt = evtName.startsWith('pointer') && typeof PointerEvent !== 'undefined' ? PointerEvent : MouseEvent;
                            elem.dispatchEvent(new Evt(evtName, { bubbles: true, cancelable: true, view: window }));
                          });
                        };
                        fireClick(degreeBtn);
                        await new Promise((r) => setTimeout(r, 400));
                        const options = Array.from(document.querySelectorAll<HTMLElement>('[role="option"], li, [data-automation-id="menuItem"]'));
                        const bachelorsOpt = options.find((opt) => (opt.textContent || '').trim().toLowerCase().includes('bachelor'));
                        if (bachelorsOpt) {
                          fireClick(bachelorsOpt);
                          degreeSelected = true;
                        }
                      }

                      await new Promise((r) => setTimeout(r, 400));

                      const fosInp = (document.querySelector('input[id*="fieldOfStudy" i]') || document.getElementById('education-38--fieldOfStudy')) as HTMLInputElement;
                      let fosSelected = false;
                      if (fosInp) {
                        setVal(fosInp, 'Computer Science');
                        fosInp.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', code: 'Enter', keyCode: 13, which: 13, bubbles: true }));
                        fosInp.dispatchEvent(new KeyboardEvent('keyup', { key: 'Enter', code: 'Enter', keyCode: 13, which: 13, bubbles: true }));
                        await new Promise((r) => setTimeout(r, 500));
                        const options = Array.from(document.querySelectorAll<HTMLElement>('[role="option"], [data-automation-id="menuItem"], [data-automation-id*="promptOption" i]'));
                        const csOpt = options.find((opt) => {
                          const t = (opt.getAttribute('data-automation-label') || opt.textContent || '').trim().toLowerCase();
                          return t.includes('computer') && t.includes('science');
                        });
                        if (csOpt) {
                          const target = csOpt.querySelector<HTMLElement>('[data-automation-id="promptLeafNode"]') || csOpt;
                          const fireClick = (elem: HTMLElement) => {
                            ['pointerdown', 'mousedown', 'pointerup', 'mouseup', 'click'].forEach((evtName) => {
                              const Evt = evtName.startsWith('pointer') && typeof PointerEvent !== 'undefined' ? PointerEvent : MouseEvent;
                              elem.dispatchEvent(new Evt(evtName, { bubbles: true, cancelable: true, view: window }));
                            });
                          };
                          fireClick(target);
                          fireClick(csOpt);
                          fosSelected = true;
                        }
                      }

                      return {
                        success: true,
                        school: school?.value,
                        gpa: gpa?.value,
                        from: from?.value,
                        to: to?.value,
                        degreeSelected,
                        fosSelected,
                      };
                    }
                    return { error: 'unknown action' };
                  } catch (e: any) {
                    return { error: e?.message || String(e) };
                  }
                },
                args: [cmd.action],
              }).then((results) => {
                fetch('http://127.0.0.1:8765/log', {
                  method: 'POST',
                  body: JSON.stringify(results?.[0]?.result || {}),
                }).catch(() => {});
              });
            });
          } else if (cmd.type === 'DUMP_WORKDAY') {
            chrome.tabs.query({ url: '*://*.myworkdayjobs.com/*' }, (tabs) => {
              const tab = tabs[0];
              if (!tab || !tab.id) {
                fetch('http://127.0.0.1:8765/dump', {
                  method: 'POST',
                  body: JSON.stringify({ error: 'No Workday tab found' }),
                }).catch(() => {});
                return;
              }
              chrome.scripting.executeScript({
                target: { tabId: tab.id },
                func: () => {
                  const inputs = Array.from(document.querySelectorAll('input, select, textarea, button[role="combobox"], [data-automation-id*="formField" i] button')).map((el) => {
                    const inp = el as HTMLInputElement;
                    return {
                      tag: el.tagName,
                      id: el.id,
                      autoId: el.getAttribute('data-automation-id'),
                      type: inp.type,
                      name: inp.name,
                      value: inp.value ?? el.textContent?.trim(),
                      checked: inp.checked,
                      placeholder: inp.placeholder,
                      closestLabel:
                        el.closest('label')?.textContent?.trim() ||
                        document.querySelector(`label[for="${el.id}"]`)?.textContent?.trim() ||
                        el.closest('[data-automation-id*="formField" i]')?.querySelector('label')?.textContent?.trim() ||
                        '',
                    };
                  });
                  const buttons = Array.from(document.querySelectorAll<HTMLElement>('button, [role="button"]')).map((b) => ({
                    text: b.textContent?.trim().slice(0, 50),
                    autoId: b.getAttribute('data-automation-id'),
                    id: b.id,
                  }));
                  const headings = Array.from(document.querySelectorAll('h1, h2, h3, h4, [data-automation-id*="pageHeader" i], [data-automation-id*="section" i]')).map(
                    (h) => h.textContent?.trim()
                  );
                  const errors = Array.from(document.querySelectorAll('[data-automation-id*="error" i], [class*="error" i], [role="alert" i]'))
                    .map((e) => e.textContent?.trim())
                    .filter(Boolean);
                  return { headings, inputs, buttons, errors, url: window.location.href, title: document.title, bodySnippet: document.body.innerText.slice(0, 800) };
                },
              }).then((results) => {
                fetch('http://127.0.0.1:8765/dump', {
                  method: 'POST',
                  body: JSON.stringify(results?.[0]?.result || {}),
                }).catch(() => {});
              }).catch((err) => {
                fetch('http://127.0.0.1:8765/dump', {
                  method: 'POST',
                  body: JSON.stringify({ error: err.message }),
                }).catch(() => {});
              });
            });
          } else if (cmd.type === 'TRIGGER_AUTOFILL') {
            chrome.tabs.query({ url: ['*://*.myworkdayjobs.com/*', '*://*.ashbyhq.com/*'] }, (tabs) => {
              const tab = tabs[0];
              if (!tab || !tab.id) {
                fetch('http://127.0.0.1:8765/log', {
                  method: 'POST',
                  body: JSON.stringify({ error: 'No ATS tab found' }),
                }).catch(() => {});
                return;
              }
              chrome.tabs.sendMessage(tab.id, { action: 'AUTOFILL' }, (response) => {
                fetch('http://127.0.0.1:8765/log', {
                  method: 'POST',
                  body: JSON.stringify(response || { error: 'No response from content script' }),
                }).catch(() => {});
              });
            });
          } else if (cmd.type === 'RELOAD_EXTENSION') {
            fetch('http://127.0.0.1:8765/log', {
              method: 'POST',
              body: JSON.stringify({ reloaded: true }),
            }).then(() => {
              chrome.runtime.reload();
            }).catch(() => {
              chrome.runtime.reload();
            });
          }
        }
      }
    } catch {}
    isPolling = false;
    setTimeout(pollDevServer, 1000);
  };
  pollDevServer();
}
