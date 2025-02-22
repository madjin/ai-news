// src/plugins/sources/GitHubDataSource.ts

import { ContentSource } from "./ContentSource";  // Your unified interface
import { ContentItem } from "../../types";         // Your unified item interface
import fetch from "node-fetch";

interface GithubDataSourceConfig {
  name: string;                // e.g. "github-data"
  contributorsUrl: string;     // e.g. "https://elizaos.github.io/data/daily/contributors.json"
  summaryUrl: string;          // e.g. "https://elizaos.github.io/data/daily/summary.json"
  githubCompany: string,
  githubRepo: string,
}

/**
 * A plugin that fetches GitHub-like data (contributors + summary)
 * from the two specified JSON endpoints and returns ContentItems.
 */
export class GitHubDataSource implements ContentSource {
  public name: string;
  private contributorsUrl: string;
  private summaryUrl: string;
  private githubCompany: string;
  private githubRepo: string;
  private baseGithubUrl: string;

  constructor(config: GithubDataSourceConfig) {
    this.name = config.name;
    this.contributorsUrl = config.contributorsUrl;
    this.summaryUrl = config.summaryUrl;
    this.githubCompany = config.githubCompany;
    this.githubRepo = config.githubRepo;
    this.baseGithubUrl = `https://github.com/${this.githubCompany}/${this.githubRepo}/`
  }

  /**
   * Fetch items from both JSON endpoints and unify them
   * into an array of ContentItem objects.
   */
  public async fetchItems(): Promise<ContentItem[]> {
    try {
      const contributorsResp = await fetch(this.contributorsUrl);
      if (!contributorsResp.ok) {
        console.error(`Failed to fetch contributors.json. Status: ${contributorsResp.status}`);
        return [];
      }
      const contributorsData = await contributorsResp.json();

      const summaryResp = await fetch(this.summaryUrl);
      if (!summaryResp.ok) {
        console.error(`Failed to fetch summary.json. Status: ${summaryResp.status}`);
        return [];
      }
      const summaryData : any = await summaryResp.json();

      const githubItems : ContentItem[] = [];

      (Array.isArray(contributorsData)
        ? contributorsData : [] ).forEach((c: any) => {
          if ( c.activity?.code?.commits?.length > 0 ) {
            c.activity?.code?.commits?.forEach((commit: any) => {
              const item : ContentItem = {
                type: "githubCommitContributor",
                cid: `github-commit-${commit.sha}`,
                source: this.name,
                link: `${this.baseGithubUrl}commit/${commit.sha}`,
                text: commit.message,
                date: new Date().getTime() / 1000,
                metadata: {
                    additions: commit.additions,
                    deletions: commit.deletions,
                    changed_files: commit.changed_files,
                    photos: [c.avatar_url]
                },
              }

              githubItems.push(item);
            })
          }

          if ( c.activity?.code?.pull_requests?.length > 0 ) {
            c.activity?.code?.pull_requests?.forEach((pr: any) => {
              const item : ContentItem = {
                type: "githubPullRequestContributor",
                cid: `github-pull-${pr.number}`,
                source: this.name,
                link: `${this.baseGithubUrl}pull/${pr.number}`,
                text: `Title: ${pr.title}\nBody: ${pr.body}`,
                date: new Date().getTime() / 1000,
                metadata: {
                  number: pr.number,
                  state: pr.state,
                  merged: pr.merged,
                  photos: [c.avatar_url]
                },
              }

              githubItems.push(item);
            })
          }

          if ( c.activity?.issues?.opened?.length > 0 ) {
            c.activity?.issues?.opened?.forEach((issue: any) => {
              const item : ContentItem = {
                type: "githubIssueContributor",
                cid: `github-issue-${issue.number}`,
                source: this.name,
                link: `${this.baseGithubUrl}issues/${issue.number}`,
                text: `Title: ${issue.title}\nBody: ${issue.body}`,
                date: new Date().getTime() / 1000,
                metadata: {
                  number: issue.number,
                  state: issue.state,
                  photos: [c.avatar_url]
                },
              }

              githubItems.push(item);
            })
          }
        });
      
      const cid = `github-contrib-${summaryData.title}`;

      const summaryItem: ContentItem = {
        type: "githubSummary",
        title: summaryData.title,
        cid: cid,
        source: this.name,
        text: summaryData.overview,
        date: new Date().getTime() / 1000,
        metadata: {
          metrics: summaryData.metrics,
          changes: summaryData.changes,
          areas: summaryData.areas,
          issues_summary: summaryData.issues_summary,
          top_contributors: summaryData.top_contributors,
          questions: summaryData.questions,
        },
      };

      return [...githubItems, summaryItem];
    } catch (error) {
      console.error("Error fetching GitHub data:", error);
      return [];
    }
  }
}