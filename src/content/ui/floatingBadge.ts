import { getActiveProfile } from '../../storage/profileStorage';
import { autofillAshby, isAshbyForm } from '../ashby/ashbyFiller';
import { autofillWorkday, isWorkdayForm, detectWorkdayStep } from '../workday/workdayFiller';

const BADGE_ID = 'instapp-floating-badge-root';

export function injectFloatingBadge(): void {
  // Prevent duplicate injections
  if (document.getElementById(BADGE_ID)) return;

  const container = document.createElement('div');
  container.id = BADGE_ID;
  container.style.position = 'fixed';
  container.style.bottom = '24px';
  container.style.right = '24px';
  container.style.zIndex = '999999';
  container.style.fontFamily = 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';

  // Create Shadow DOM to protect extension styles from page CSS
  const shadow = container.attachShadow({ mode: 'open' });

  const style = document.createElement('style');
  style.textContent = `
    .badge-card {
      display: flex;
      align-items: center;
      gap: 10px;
      background: linear-gradient(135deg, #4f46e5 0%, #6366f1 100%);
      color: white;
      padding: 10px 16px;
      border-radius: 9999px;
      box-shadow: 0 10px 25px -5px rgba(79, 70, 229, 0.4), 0 8px 10px -6px rgba(79, 70, 229, 0.2);
      cursor: pointer;
      user-select: none;
      transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
      border: 1px solid rgba(255, 255, 255, 0.2);
    }
    .badge-card:hover {
      transform: translateY(-2px);
      box-shadow: 0 15px 30px -5px rgba(79, 70, 229, 0.5), 0 10px 12px -6px rgba(79, 70, 229, 0.3);
      filter: brightness(1.05);
    }
    .badge-card:active {
      transform: translateY(0);
    }
    .badge-icon {
      width: 20px;
      height: 20px;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .badge-title {
      font-size: 14px;
      font-weight: 600;
      letter-spacing: -0.01em;
    }
    .badge-status {
      font-size: 12px;
      opacity: 0.9;
    }
    .spinner {
      width: 14px;
      height: 14px;
      border: 2px solid rgba(255,255,255,0.3);
      border-top-color: white;
      border-radius: 50%;
      animation: spin 0.8s linear infinite;
    }
    @keyframes spin {
      to { transform: rotate(360deg); }
    }
    .close-btn {
      margin-left: 6px;
      opacity: 0.7;
      font-size: 16px;
      line-height: 1;
      padding: 2px 4px;
      border-radius: 4px;
    }
    .close-btn:hover {
      opacity: 1;
      background: rgba(255,255,255,0.15);
    }
  `;

  const getInitialTitle = (): string => {
    if (isWorkdayForm()) {
      const step = detectWorkdayStep();
      const stepLabels: Record<string, string> = {
        information: 'My Information',
        experience: 'My Experience',
        questions: 'Questions',
        disclosures: 'Disclosures',
        review: 'Review',
      };
      const label = stepLabels[step];
      return label ? `Fill Step: ${label}` : 'Fill Workday Step';
    }
    return 'Fill with Instapp';
  };

  const badgeCard = document.createElement('div');
  badgeCard.className = 'badge-card';

  badgeCard.innerHTML = `
    <div class="badge-icon">
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
        <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"></polygon>
      </svg>
    </div>
    <div class="badge-title">${getInitialTitle()}</div>
    <div class="close-btn" title="Dismiss">×</div>
  `;

  shadow.appendChild(style);
  shadow.appendChild(badgeCard);

  const closeBtn = badgeCard.querySelector('.close-btn') as HTMLElement;
  closeBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    container.remove();
  });

  badgeCard.addEventListener('click', async () => {
    const titleEl = badgeCard.querySelector('.badge-title') as HTMLElement;
    const iconEl = badgeCard.querySelector('.badge-icon') as HTMLElement;

    const originalTitle = titleEl.textContent;
    titleEl.textContent = 'Filling...';
    iconEl.innerHTML = '<div class="spinner"></div>';

    try {
      const profile = await getActiveProfile();
      const isWorkday = isWorkdayForm();
      const report = isWorkday ? await autofillWorkday(profile) : await autofillAshby(profile);

      iconEl.innerHTML = `
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
          <polyline points="20 6 9 17 4 12"></polyline>
        </svg>
      `;
      titleEl.textContent = `Filled ${report.fieldsFilled} fields!`;

      setTimeout(() => {
        titleEl.textContent = getInitialTitle();
        iconEl.innerHTML = `
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"></polygon>
          </svg>
        `;
      }, 3000);
    } catch (err) {
      console.error('[Instapp] Autofill error:', err);
      titleEl.textContent = 'Error filling fields';
      setTimeout(() => {
        titleEl.textContent = originalTitle;
      }, 2500);
    }
  });

  document.body.appendChild(container);
}
