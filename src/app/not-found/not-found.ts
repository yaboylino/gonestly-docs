import { ChangeDetectionStrategy, Component, inject, OnInit } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';

import { DocsContext } from '../language/docs-context';
import { Seo } from '../seo/seo';

@Component({
  selector: 'app-not-found',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, TranslatePipe],
  template: `
    <section class="not-found">
      <h1>{{ 'notFound.title' | translate }}</h1>
      <p>{{ 'notFound.text' | translate }}</p>
      <a class="button" [routerLink]="['/', lang(), 'introduction']">{{
        'notFound.home' | translate
      }}</a>
    </section>
  `,
  styles: `
    .not-found {
      max-width: 760px;
      padding: 72px 48px;
    }
    h1 {
      margin: 0 0 12px;
      font-family: var(--font-head);
      font-size: 40px;
      font-weight: 400;
      text-transform: uppercase;
      color: var(--ink);
    }
    p {
      margin: 0 0 24px;
      color: var(--text-soft);
      font-size: 17px;
    }
    .button {
      display: inline-flex;
      align-items: center;
      height: 40px;
      padding: 0 18px;
      border-radius: 8px;
      background: var(--brand);
      color: #000;
      font-weight: 800;
    }
    @media (max-width: 680px) {
      .not-found {
        padding: 48px 20px;
      }
    }
  `,
})
export class NotFound implements OnInit {
  private readonly context = inject(DocsContext);
  private readonly seo = inject(Seo);
  private readonly translate = inject(TranslateService);

  protected readonly lang = this.context.lang;

  ngOnInit(): void {
    this.context.slug.set(null);
    this.seo.update(
      this.translate.instant('notFound.title'),
      this.translate.instant('notFound.text'),
      this.lang(),
      null,
    );
  }
}
